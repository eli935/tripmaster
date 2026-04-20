"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PlanSeedPanel({ tripId }: { tripId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; days_seeded: number; total_items: number; guardrails: { phones_stripped: number; cars_removed: number } }
    | null
  >(null);

  async function handleSeed() {
    const trimmed = text.trim();
    if (trimmed.length < 20) {
      toast.error("הטקסט קצר מדי");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/trip/${tripId}/plan/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setResult(data);
      toast.success(`הוטמעו ${data.total_items} פריטים ב-${data.days_seeded} ימים`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשתילה");
    } finally {
      setSending(false);
    }
  }

  const example = `יום 1:
9:00 יציאה מהמלון
9:30 הגעה לקוטור (העיר העתיקה) — טיפוס לחומות, כשעתיים
12:00 ארוחת צהריים במסעדת שלום
15:00 שייט בפרסט ואי קנסות גוספה מוצץ
19:30 ארוחת ערב במלון

יום 2:
8:00 ארוחת בוקר
9:30 לובצ'ן — מאוזוליאום של נגוש
13:00 פיקניק בפארק הלאומי
17:00 חזרה למלון`;

  return (
    <Card className="border-[var(--gold-500)]/20 bg-[var(--gold-500)]/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-4 h-4 text-[var(--gold-400)]" />
          שתילת תוכנית (Concierge)
        </CardTitle>
        <CardDescription className="text-xs">
          כתוב תוכנית ביד בטקסט חופשי — אנחנו נפרסר, נעצב ונציג אותה ללקוח כתוכנית מוכנה. הלקוח יוכל לשנות
          מעליה. שדה זה גלוי רק למנהל.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={example}
            rows={10}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-[var(--gold-500)]/50 font-mono leading-relaxed"
            maxLength={20000}
          />
          <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Info size={10} />
              חלק לימים ("יום 1", "יום 2"), שעות רשות. Claude יבנה JSON מובנה ויחיל את כל ה-guardrails.
            </span>
            <span className="tabular-nums">{text.length} / 20,000</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSeed}
            disabled={sending || text.trim().length < 20}
            className="bg-gradient-to-l from-[var(--gold-700)] to-[var(--gold-500)] text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מפרסר ומתקין...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 ml-2" />
                שתול כתוכנית יומית
              </>
            )}
          </Button>
          {text.length > 0 && (
            <button onClick={() => setText("")} className="text-xs text-muted-foreground hover:text-foreground">
              נקה
            </button>
          )}
        </div>

        {result && result.ok && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[var(--olive-500)]/30 bg-[var(--olive-500)]/10 p-3 text-xs space-y-1"
          >
            <div className="font-medium text-[var(--olive-200)]">✓ שתילה הושלמה</div>
            <div className="text-foreground/70">
              {result.total_items} פריטים הוטמעו ב-{result.days_seeded} ימים.
              {result.guardrails.phones_stripped > 0 && (
                <span className="block mt-1 text-amber-300">
                  ⚠ {result.guardrails.phones_stripped} מספרי טלפון הוסרו (הוכנסו ב-notes כהערות). אמת ידנית לפני שיתוף.
                </span>
              )}
              {result.guardrails.cars_removed > 0 && (
                <span className="block mt-1 text-amber-300">
                  🕯 {result.guardrails.cars_removed} פריטי רכב הוסרו מימי שבת/חג.
                </span>
              )}
              <span className="block mt-1 text-muted-foreground">
                הלקוח יראה את התוכנית בעמוד "תכנון הטיול" ויכול לשנות מעליה. Snapshot נשמר בשם "תוכנית המנהל" ב-History.
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
