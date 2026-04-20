"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { requestSoftDelete } from "@/lib/soft-delete";

interface DeleteButtonProps {
  table: string;
  recordId: string;
  tripId: string;
  userId: string;
  isAdmin: boolean;
  className?: string;
}

export function DeleteButton({
  table,
  recordId,
  tripId,
  userId,
  isAdmin,
  className = "",
}: DeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await requestSoftDelete(table, recordId, tripId, userId, isAdmin);
    setLoading(false);
    setConfirm(false);

    if (result.success) {
      if (result.pendingApproval) {
        toast.success("בקשת מחיקה נשלחה למנהל לאישור", {
          icon: <Clock className="h-4 w-4" />,
        });
      } else {
        toast.success("נמחק");
      }
      router.refresh();
    } else {
      toast.error("שגיאה במחיקה", {
        description: result.error || "לא התקבלה הודעת שגיאה מפורטת",
      });
    }
  }

  if (confirm) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex gap-1"
      >
        <Button
          size="icon"
          variant="destructive"
          className="h-7 w-7"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setConfirm(false)}
        >
          ✕
        </Button>
      </motion.div>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10 ${className}`}
      onClick={() => setConfirm(true)}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
