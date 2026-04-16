"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircle } from "lucide-react";
import type { TripMessage } from "@/lib/types-v8";
import type { TripParticipant } from "@/lib/supabase/types";

interface TripChatProps {
  tripId: string;
  userId: string;
  userName: string;
  participants: TripParticipant[];
}

export function TripChat({ tripId, userId, userName, participants }: TripChatProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Profile names lookup
  const profileNames: Record<string, string> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || "???";
  });

  // Load messages + subscribe to realtime
  useEffect(() => {
    let channel: any;

    async function load() {
      const { data } = await supabase
        .from("trip_messages")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages(data || []);
      setLoading(false);
      setTimeout(scrollToBottom, 100);

      // Realtime subscription
      channel = supabase
        .channel(`chat-${tripId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "trip_messages",
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as TripMessage]);
            setTimeout(scrollToBottom, 50);
          }
        )
        .subscribe();
    }

    load();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId, supabase]);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const content = input.trim();
    setInput("");

    await supabase.from("trip_messages").insert({
      trip_id: tripId,
      sender_id: userId,
      content,
    });

    setSending(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] rounded-2xl glass overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <div className="h-9 w-9 rounded-full gradient-blue flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-semibold">צ׳אט טיול</div>
          <div className="text-xs text-muted-foreground">
            {participants.length} משתתפים
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 opacity-30 mb-2" />
            <p className="text-sm">עדיין אין הודעות</p>
            <p className="text-xs">שלח הודעה ראשונה!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              const senderName = profileNames[msg.sender_id] || "משתמש";
              const time = new Date(msg.created_at).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isMe ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[75%] ${isMe ? "order-1" : "order-2"}`}>
                    {!isMe && (
                      <div className="text-xs text-muted-foreground mb-1 px-2">
                        {senderName}
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isMe
                          ? "gradient-blue text-white rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isMe ? "text-white/60" : "text-muted-foreground"
                        }`}
                      >
                        {time}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="הודעה..."
          className="h-11 rounded-full bg-secondary/50"
          disabled={sending}
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 rounded-full gradient-blue border-0 shrink-0"
          disabled={!input.trim() || sending}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
