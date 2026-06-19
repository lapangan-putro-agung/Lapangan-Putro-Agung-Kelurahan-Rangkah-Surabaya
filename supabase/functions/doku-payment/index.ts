import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOKU_SANDBOX_URL = "https://api-sandbox.doku.com/checkout/v1/payment";
const PAYMENT_TIMEOUT = 90000;

async function generateDigest(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generateSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  digest: string,
  secretKey: string
): Promise<string> {
  const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(componentSignature));
  return `HMACSHA256=${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

interface DokuResponse {
  response?: {
    payment?: {
      url?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function callDokuWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  attempt = 1
): Promise<DokuResponse> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(PAYMENT_TIMEOUT),
    });

    // 4xx errors - don't retry
    if (response.status >= 400 && response.status < 500) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = `DOKU error [${response.status}]: ${JSON.stringify(errorData)}`;
      console.error("DOKU 4xx error (no retry):", errorMsg);
      throw new Error(errorMsg);
    }

    // 5xx errors - retryable
    if (!response.ok) {
      throw new Error(`DOKU server error: ${response.status}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await response.text();
      console.error("DOKU returned non-JSON:", text.substring(0, 200));
      throw new Error("DOKU returned invalid response format");
    }

    return await response.json();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message.includes("DOKU error [4")) throw err;

    console.error(`DOKU attempt ${attempt}/3 failed:`, err.message);
    if (attempt >= 3) {
      throw new Error(`DOKU unavailable after 3 attempts: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    return callDokuWithRetry(url, headers, body, attempt + 1);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOKU_CLIENT_ID = Deno.env.get("DOKU_CLIENT_ID");
    if (!DOKU_CLIENT_ID) throw new Error("DOKU_CLIENT_ID is not configured");

    const DOKU_API_KEY = Deno.env.get("DOKU_API_KEY");
    if (!DOKU_API_KEY) throw new Error("DOKU_API_KEY is not configured");

    const DOKU_SECRET_KEY = Deno.env.get("DOKU_SECRET_KEY");
    if (!DOKU_SECRET_KEY) throw new Error("DOKU_SECRET_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const anonClient = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { bookingId, amount, courtLabel, date, timeSlot } = await req.json();
    if (!bookingId || !amount) throw new Error("Missing required fields");

    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestTarget = "/checkout/v1/payment";

    // Build callback URL to redirect user back to dashboard after payment
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "";
    const callbackUrl = `${origin}/dashboard?payment=success&booking=${bookingId}`;

    const requestBody = JSON.stringify({
      order: {
        amount: amount,
        invoice_number: bookingId,
        callback_url: callbackUrl,
	auto_redirect: true,
      },
      payment: {
        payment_due_date: 60,
      },
      customer: {
        id: user.id,
        name: user.user_metadata?.full_name || user.email || "Customer",
        email: user.email || "",
      },
    });

    const digest = await generateDigest(requestBody);
    const signature = await generateSignature(
      DOKU_CLIENT_ID,
      requestId,
      requestTimestamp,
      requestTarget,
      digest,
      DOKU_SECRET_KEY
    );

    console.log("Sending DOKU request with Client-Id:", DOKU_CLIENT_ID);
    console.log("Request-Id:", requestId);

    const dokuData = await callDokuWithRetry(
      DOKU_SANDBOX_URL,
      {
        "Content-Type": "application/json",
        "Client-Id": DOKU_CLIENT_ID,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        Signature: signature,
      },
      requestBody
    );

    console.log("DOKU response:", JSON.stringify(dokuData));

    const payment_url: string = dokuData.response?.payment?.url;
    await supabase
      .from("bookings")
      .update({ payment_url: payment_url, payment_status: "pending" })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({
        payment_url: payment_url,
        invoice_number: bookingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("DOKU payment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
