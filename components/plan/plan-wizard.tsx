"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { TripPreferences, TripPace, TripTransport, MealStyle } from "@/lib/supabase/types";

const INTEREST_OPTIONS = [
  { id: "nature",    label: "🌳 טבע" },
  { id: "historic",  label: "🏛️ היסטוריה" },
  { id: "beach",     label: "🏖️ חוף" },
  { id: "museum",    label: "🖼️ מוזיאונים" },
  { id: "activity",  label: "⚡ אטרקציות פעילות" },
  { id: "viewpoint", label: "🔭 תצפיות" },
  { id: "religious", label: "✡️ דתי" },
  { id: "kids",      label: "🧸 ילדים" },
];

const CUISINE_OPTIONS = ["איטלקי", "מקומי", "כשר", "צמחוני", "פיצה/פסטה", "ים תיכוני"];

export function PlanWizard({
  tripId,
  initialPreferences,
  onClose,
  onGenerated,
}: {
  tripId: string;
  initialPreferences?: TripPreferences | null;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<TripPreferences>({
    pace: initialPreferences?.pace ?? "balanced",
    interests: initialPreferences?.interests ?? [],
    transport: initialPreferences?.transport ?? "rental_car",
    daily_start: initialPreferences?.daily_start ?? "09:00",
    daily_end: initialPreferences?.daily_end ?? "20:00",
    siesta: initialPreferences?.siesta ?? false,
    meals: initialPreferences?.meals ?? { style: "mixed", cuisines: [], kosher_level: "מהדרין" },
    budget_per_day: initialPreferences?.budget_per_day,
  });
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalSteps = 5;

  function toggleInterest(id: string) {
    setPrefs((p) => {
      const s = new Set(p.interests ?? []);
      if (s.has(id)) s.delete(id); else s.add(id);
      return { ...p, interests: Array.from(s) };
    });
  }

  function toggleCuisine(c: string) {
    setPrefs((p) => {
      const s = new Set(p.meals?.cuisines ?? []);
      if (s.has(c)) s.delete(c); else s.add(c);
      return { ...p, meals: { ...p.meals, cuisines: Array.from(s) } };
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/trip/${tripId}/plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "AI failed");
      }
      const data = await res.json();
      toast.success(`נוצרה תוכנית ל-${data.days_generated} ימים · ${data.total_items} פריטים`);
      onGenerated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "שגיאה ביצירת התוכנית");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full md:max-w-xl md:rounded-3xl bg-[color:var(--card)] overflow-hidden md:border border-[color:var(--gold-500)]/30 shadow-2xl flex flex-col md:h-auto h-full md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[color:var(--gold-400)]" size={20} />
            <h2 className="font-serif text-xl text-[color:var(--gold-100)]">תכנון מלא עם AI</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-foreground/60">
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? "bg-[color:var(--gold-500)]" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[280px] flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <Step title="קצב הטיול">
                  <p className="text-xs text-foreground/60 mb-3">כמה אתם רוצים לדחוס ליום?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["slow", "איטי", "3-4 פריטים"],
                      ["balanced", "מאוזן", "5-6 פריטים"],
                      ["packed", "אינטנסיבי", "7-8 פריטים"],
                    ] as [TripPace, string, string][]).map(([id, label, sub]) => (
                      <button
                        key={id}
                        onClick={() => setPrefs((p) => ({ ...p, pace: id }))}
                        className={`rounded-xl p-3 text-center border-2 transition ${
                          prefs.pace === id
                            ? "border-[color:var(--gold-500)] bg-[color:var(--gold-500)]/10"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-sm font-medium text-[color:var(--gold-100)]">{label}</div>
                        <div className="text-[10px] text-foreground/60 mt-0.5">{sub}</div>
                      </button>
                    ))}
                  </div>
                </Step>
              )}

              {step === 2 && (
                <Step title="מה מעניין אתכם?">
                  <p className="text-xs text-foreground/60 mb-3">ניתן לבחור כמה שתרצו</p>
                  <div className="grid grid-cols-2 gap-2">
                    {INTEREST_OPTIONS.map((opt) => {
                      const selected = (prefs.interests ?? []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleInterest(opt.id)}
                          className={`rounded-xl p-2.5 text-start border-2 transition text-sm ${
                            selected
                              ? "border-[color:var(--gold-500)] bg-[color:var(--gold-500)]/10 text-[color:var(--gold-100)]"
                              : "border-white/10 text-foreground/80 hover:border-white/20"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Step>
              )}

              {step === 3 && (
                <Step title="תחבורה וזמנים">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-foreground/60 mb-2">איך תסתובבו?</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["rental_car", "🚗 רכב שכור"],
                          ["taxi", "🚕 מוניות"],
                          ["walking", "🚶 הליכה"],
                          ["mixed", "🔀 משולב"],
                        ] as [TripTransport, string][]).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => setPrefs((p) => ({ ...p, transport: id }))}
                            className={`rounded-xl p-2.5 text-center border-2 transition text-sm ${
                              prefs.transport === id
                                ? "border-[color:var(--gold-500)] bg-[color:var(--gold-500)]/10 text-[color:var(--gold-100)]"
                                : "border-white/10 text-foreground/80"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <div className="text-xs text-foreground/60 mb-1">יציאה מהמלון</div>
                        <input
                          type="time"
                          value={prefs.daily_start}
                          onChange={(e) => setPrefs((p) => ({ ...p, daily_start: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs text-foreground/60 mb-1">חזרה</div>
                        <input
                          type="time"
                          value={prefs.daily_end}
                          onChange={(e) => setPrefs((p) => ({ ...p, daily_end: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prefs.siesta ?? false}
                        onChange={(e) => setPrefs((p) => ({ ...p, siesta: e.target.checked }))}
                        className="h-4 w-4 accent-[color:var(--gold-600)]"
                      />
                      <span className="text-sm text-foreground/80">כולל מנוחת צהריים במלון</span>
                    </label>
                  </div>
                </Step>
              )}

              {step === 4 && (
                <Step title="אוכל">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-foreground/60 mb-2">איפה תאכלו בעיקר?</div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ["restaurant", "🍽️ מסעדות"],
                          ["self_cooking", "🍳 בישול בדירה"],
                          ["mixed", "🔀 משולב"],
                        ] as [MealStyle, string][]).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() =>
                              setPrefs((p) => ({ ...p, meals: { ...p.meals, style: id } }))
                            }
                            className={`rounded-xl p-2.5 text-center border-2 transition text-sm ${
                              prefs.meals?.style === id
                                ? "border-[color:var(--gold-500)] bg-[color:var(--gold-500)]/10 text-[color:var(--gold-100)]"
                                : "border-white/10 text-foreground/80"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/60 mb-2">סוגי מטבח מועדפים</div>
                      <div className="flex flex-wrap gap-1.5">
                        {CUISINE_OPTIONS.map((c) => {
                          const selected = (prefs.meals?.cuisines ?? []).includes(c);
                          return (
                            <button
                              key={c}
                              onClick={() => toggleCuisine(c)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                                selected
                                  ? "border-[color:var(--gold-500)] bg-[color:var(--gold-500)]/10 text-[color:var(--gold-100)]"
                                  : "border-white/10 text-foreground/70"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <div className="text-xs text-foreground/60 mb-1">רמת כשרות</div>
                      <input
                        type="text"
                        value={prefs.meals?.kosher_level ?? ""}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            meals: { ...p.meals, kosher_level: e.target.value },
                          }))
                        }
                        placeholder="מהדרין / רבנות / חלק"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </Step>
              )}

              {step === 5 && (
                <Step title="תקציב יומי למשפחה (אופציונלי)">
                  <p className="text-xs text-foreground/60 mb-3">
                    ה-AI ישקול את זה כשיציע אטרקציות ומסעדות
                  </p>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={200}
                      max={2000}
                      step={50}
                      value={prefs.budget_per_day ?? 800}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, budget_per_day: Number(e.target.value) }))
                      }
                      className="w-full accent-[color:var(--gold-600)]"
                    />
                    <div className="text-center text-2xl font-serif text-[color:var(--gold-100)] tabular-nums">
                      ₪{prefs.budget_per_day ?? 800}
                    </div>
                    <div className="text-[10px] text-foreground/60 text-center">
                      למשפחה ליום — אפשר לדלג
                    </div>
                  </div>
                </Step>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {errorMsg && (
          <div className="mx-6 mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <div className="text-sm text-red-300 font-medium mb-1">שגיאה ביצירת התוכנית</div>
            <div className="text-xs text-red-200/80 mb-2">{errorMsg}</div>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 text-xs font-medium hover:bg-red-500/30 transition"
            >
              <Sparkles size={12} /> נסה שוב
            </button>
          </div>
        )}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || generating}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-foreground/70 hover:bg-white/5 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight size={16} /> חזור
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[color:var(--gold-600)] text-white text-sm font-medium hover:bg-[color:var(--gold-500)] transition"
            >
              הבא <ChevronLeft size={16} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[color:var(--gold-600)] text-white text-sm font-medium hover:bg-[color:var(--gold-500)] transition disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Claude עובד... ~30 שנ׳
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  צור תוכנית
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-[color:var(--gold-100)] mb-3">{title}</h3>
      {children}
    </div>
  );
}
