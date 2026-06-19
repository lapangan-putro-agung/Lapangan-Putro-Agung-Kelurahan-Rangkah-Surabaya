import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export function useChat(userId: string | undefined, role: "user" | "admin") {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    if (role === "user") {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      
      if (data && data.length > 0) {
        setConversations(data as ChatConversation[]);
        setActiveConversationId((prev) => prev || data[0].id);
      } else {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({ user_id: userId })
          .select()
          .single();
        if (newConv) {
          setConversations([newConv as ChatConversation]);
          setActiveConversationId(newConv.id);
        }
      }
    } else {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) {
        setConversations(data as ChatConversation[]);
        setActiveConversationId((prev) => prev || (data.length > 0 ? data[0].id : null));
      }
    }
    setLoading(false);
  }, [userId, role]);

  // Fetch conversations
  useEffect(() => {
    if (!userId) return;
    fetchConversations();
  }, [userId, fetchConversations]);

  // Realtime: listen for new/updated conversations (admin sees new users)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchConversations]);

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      setMessages((data || []) as ChatMessage[]);
    };

    fetchMessages();

    // Subscribe to realtime
    const channel = supabase
      .channel(`chat-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  const sendMessage = useCallback(
    async (content: string | null, imageUrl: string | null) => {
      if (!userId || !activeConversationId) return;
      if (!content && !imageUrl) return;

      await supabase.from("chat_messages").insert({
        conversation_id: activeConversationId,
        sender_id: userId,
        sender_role: role,
        content,
        image_url: imageUrl,
      });

      // Update conversation timestamp
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversationId);
    },
    [userId, activeConversationId, role]
  );

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file);
      if (error) {
        console.error("Upload error:", error);
        return null;
      }
      const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
      return data.publicUrl;
    },
    [userId]
  );

  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .in("id", messageIds);
    },
    []
  );

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    loading,
    sendMessage,
    uploadImage,
    markAsRead,
  };
}
