import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingReceipt from "@/components/BookingReceipt";
import { Calendar, Clock, MapPin, FileText } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const COURT_LABELS: Record<string, string> = {
  voli: "🏐 Voli",
  basket: "🏀 Basket",
  soccer: "⚽ Mini Soccer",
};

interface BookingRow {
  id: string;
  user_id: string;
  court_id: string;
  booking_date: string;
  time_slot: string;
  amount: number;
  payment_status: string;
  created_at: string;
}

const UserDashboard = () => {
  const { user, profile, loading } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .then(({ data }) => {
        setBookings((data as BookingRow[]) || []);
        setFetching(false);
      });
  }, [user]);

  useEffect(() => {
    if (bookings.length === 0) return;
    const paymentStatus = searchParams.get("payment");
    const bookingId = searchParams.get("booking");
    if (paymentStatus === "success" && bookingId) {
      const found = bookings.find((b) => b.id === bookingId);
      if (found) {
        setSelectedBooking(found);
        toast({ title: "Pembayaran diproses!", description: "Nota booking kamu sudah tersedia." });
      }
      setSearchParams({}, { replace: true });
    }
  }, [bookings, searchParams, setSearchParams, toast]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Loading...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-4xl font-heading tracking-wider text-foreground">
              HALO, {profile?.full_name?.toUpperCase() || "USER"}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">Riwayat booking kamu</p>
          </div>

          {fetching ? (
            <p className="text-muted-foreground">Memuat data...</p>
          ) : bookings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada booking. Yuk pesan lapangan!</p>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookings.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl border border-border p-5 shadow hover:border-accent/30 transition cursor-pointer"
                  onClick={() => setSelectedBooking(b)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-heading tracking-wider text-foreground">
                      {COURT_LABELS[b.court_id] || b.court_id}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      b.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {b.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-accent" />
                      {format(new Date(b.booking_date), "dd MMMM yyyy", { locale: idLocale })}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent" />
                      {b.time_slot}
                    </p>
                    <p className="flex items-center gap-2 font-semibold text-foreground">
                      <MapPin className="w-4 h-4 text-accent" />
                      Rp {b.amount.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-accent flex items-center gap-1 font-semibold">
                      <FileText className="w-3 h-3" /> Lihat Nota
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Receipt Modal */}
      {selectedBooking && (
        <BookingReceipt
          booking={selectedBooking}
          userName={profile?.full_name || "User"}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
};

export default UserDashboard;
