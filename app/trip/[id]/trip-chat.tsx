"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircle, Clock, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { TripMessage } from "@/lib/types-v8";
import type { TripParticipant } from "@/lib/supabase/types";

interface TripChatProps {
  tripId: string;
  userId: string;
  userName: string;
  participants: TripParticipant[];
}

// Local UI state: extend TripMessage with optimistic flags. `pending`
// messages use a tempId (client-generated) until the realtime INSERT
// arrives and reconciles to the real server row.
interface LocalMessage extends TripMessage {
  pending?: boolean;
  error?: boolean;
  tempId?: string;
}

// Toast rate-limiter: collapse floods of incoming messages.
const TOAST_WINDOW_MS = 10_000;
const TOAST_MAX_IN_WINDOW = 5;

export function TripChat({ tripId, userId, userName: _userName, participants }: TripChatProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rate-limiter state — kept in refs so subscription callback sees latest
  const toastTimesRef = useRef<number[]>([]);
  const pendingCollapseRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; count: number }>({
    timer: null,
    count: 0,
  });

  // Profile names lookup
  const profileNames: Record<string, string> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || "—";
  });

  // Load messages + subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data } = await supabase
        .from("trip_messages")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages((data as LocalMessage[]) || []);
      setLoading(false);
      setTimeout(scrollToBottom, 100);

      try {
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
              const incoming = payload.new as TripMessage;
              setMessages((prev) => {
                // Reconcile with any pending optimistic message from this user
                // matching the same content (cheap heuristic — DB ids differ).
                const matchIdx = prev.findIndex(
                  (m) =>
                    m.pending &&
                    m.sender_id === incoming.sender_id &&
                    m.content === incoming.content
                );
                if (matchIdx !== -1) {
                  const next = [...prev];
                  next[matchIdx] = { ...incoming };
                  return next;
                }
                // Avoid duplicate if already present (e.g. server-echoed id).
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
              setTimeout(scrollToBottom, 50);

              // Toast only for messages from OTHER users
              if (incoming.sender_id !== userId) {
                notifyIncomingMessage(incoming.sender_id);
              }
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn(`[chat] realtime status: ${status}`);
            }
          });
      } catch (err) {
        console.warn("[chat] failed to subscribe:", err);
      }
    }

    function notifyIncomingMessage(senderId: string) {
      const now = Date.now();
      // Drop timestamps older than window
      toastTimesRef.current = toastTimesRef.current.filter((t) => now - t < TOAST_WINDOW_MS);
      toastTimesRef.current.push(now);

      if (toastTimesRef.current.length > TOAST_MAX_IN_WINDOW) {
        // Collapse flood: queue a single summary toast
        const state = pendingCollapseRef.current;
        state.count += 1;
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
          toast(`💬 ${state.count} הודעות חדשות`);
          state.count = 0;
          state.timer = null;
        }, 1200);
        return;
      }

      const name = profileNames[senderId] || "משתתף";
      toast(`💬 ${name} שלח הודעה`);
    }

    load();
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* noop */
        }
      }
      if (pendingCollapseRef.current.timer) {
        clearTimeout(pendingCollapseRef.current.timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, supabase, userId]);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  async function sendMessage(content: string, tempId: string) {
    const { error } = await supabase.from("trip_messages").insert({
      trip_id: tripId,
      sender_id: userId,
      content,
    });

    if (error) {
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, error: true } : m))
      );
      toast.error("שליחת ההודעה נכשלה");
    }
    // On success: realtime INSERT handler will reconcile the pending entry.
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const content = input.trim();
    setInput("");

    // Optimistic push
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: LocalMessage = {
      id: tempId,
      tempId,
      trip_id: tripId,
      sender_id: userId,
      content,
      reply_to: null,
      edited_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 30);

    await sendMessage(content, tempId);
    setSending(false);
  }

  function retrySend(msg: LocalMessage) {
    if (!msg.tempId) return;
    setMessages((prev) =>
      prev.map((m) => (m.tempId === msg.tempId ? { ...m, pending: true, error: false } : m))
    );
    sendMessage(msg.content, msg.tempId);
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

              const bubbleOpacity = msg.pending ? "opacity-70" : msg.error ? "opacity-80" : "";

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
                      className={`rounded-2xl px-4 py-2 transition-opacity ${bubbleOpacity} ${
                        isMe
                          ? "gradient-blue text-white rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      } ${msg.error ? "ring-1 ring-red-500/60" : ""}`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                          isMe ? "text-white/60" : "text-muted-foreground"
                        }`}
                      >
                        {msg.pending && <Clock className="h-2.5 w-2.5" />}
                        {msg.error && <AlertCircle className="h-2.5 w-2.5 text-red-300" />}
                        <span>{time}</span>
                      </div>
                    </div>
                    {msg.error && isMe && (
                      <button
                        type="button"
                        onClick={() => retrySend(msg)}
                        className="mt-1 px-2 text-[10px] text-red-300 hover:text-red-200 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        נסה שוב
                      </button>
                    )}
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
