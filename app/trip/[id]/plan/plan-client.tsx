"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Calendar, ChevronLeft, Check, Plus, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PlanWizard } from "@/components/plan/plan-wizard";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_THEME, type AttractionCategory } from "@/lib/destinations";
import type { Trip, TripDay, DayBooking, PlanItem } from "@/lib/supabase/types";

export function PlanClient({
  trip,
  initialDays,
}: {
  trip: Trip;
  initialDays: TripDay[];
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [days, setDays] = useState<TripDay[]>(initialDays);
  const [adopting, setAdopting] = useState<string | null>(null);

  const supabase = createClient();
  const hasAnyPlan = days.some((d) => (d.generated_plan ?? []).length > 0);

  async function refreshDays() {
    const { data } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", trip.id)
      .order("date", { ascending: true });
    if (data) setDays(data as TripDay[]);
  }

  async function adoptItem(day: TripDay, item: PlanItem, itemIdx: number) {
    if (item.type !== "attraction") return;
    setAdopting(`${day.id}-${itemIdx}`);
    try {
      const existing = (day.bookings ?? []) as DayBooking[];
      const dup = existing.some(
        (b) => b.attraction_id === item.attraction_id || b.name === item.title
      );
      if (dup) {
        toast.info("כבר קיים ברשימת האתרים של היום");
        return;
      }
      const newBooking: DayBooking = {
        booking_id: (globalThis.crypto as Crypto).randomUUID(),
        attraction_id: item.attraction_id ?? null,
        attraction_name: item.title,
        name: item.title,
        description: item.description ?? null,
        image_url: null,
        category: null,
        lat: null,
        lng: null,
        website_url: null,
        waze_url: null,
        gmaps_url: null,
        time: item.time,
        duration_minutes: item.duration_min ?? null,
        order_index: existing.length,
        user_notes: item.notes ?? null,
        created_at: new Date().toISOString(),
      };
      const nextBookings = [...existing, newBooking];
      const { error } = await supabase
        .from("trip_days")
        .update({ bookings: nextBookings })
        .eq("id", day.id);
      if (error) throw error;
      setDays((prev) =>
        prev.map((d) => (d.id === day.id ? { ...d, bookings: nextBookings } : d))
      );
      toast.success(`"${item.title}" נוסף ליום`);
    } catch {
      toast.error("שגיאה בהוספה");
    } finally {
      setAdopting(null);
    }
  }

  async function adoptAllForDay(day: TripDay) {
    const plan = (day.generated_plan ?? []) as PlanItem[];
    const attractions = plan.filter((p) => p.type === "attraction");
    if (attractions.length === 0) {
      toast.info("אין אטרקציות לאימוץ ביום זה");
      return;
    }
    const existing = (day.bookings ?? []) as DayBooking[];
    const existingKeys = new Set(existing.map((b) => b.attraction_id ?? b.name));
    const toAdd: DayBooking[] = attractions
      .filter((a) => !existingKeys.has(a.attraction_id ?? a.title))
      .map((a, i) => ({
        booking_id: (globalThis.crypto as Crypto).randomUUID(),
        attraction_id: a.attraction_id ?? null,
        attraction_name: a.title,
        name: a.title,
        description: a.description ?? null,
        image_url: null,
        category: null,
        lat: null,
        lng: null,
        website_url: null,
        waze_url: null,
        gmaps_url: null,
        time: a.time,
        duration_minutes: a.duration_min ?? null,
        order_index: existing.length + i,
        user_notes: a.notes ?? null,
        created_at: new Date().toISOString(),
      }));
    if (toAdd.length === 0) {
      toast.info("כל האטרקציות כבר מאומצות");
      return;
    }
    const nextBookings = [...existing, ...toAdd];
    const { error } = await supabase
      .from("trip_days")
      .update({ bookings: nextBookings })
      .eq("id", day.id);
    if (error) {
      toast.error("שגיאה באימוץ");
      return;
    }
    setDays((prev) =>
      prev.map((d) => (d.id === day.id ? { ...d, bookings: nextBookings } : d))
    );
    toast.success(`${toAdd.length} אטרקציות נוספו`);
  }

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-b from-[color:var(--gold-900)]/40 to-transparent px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/trip/${trip.id}`}
            className="inline-flex items-center gap-1 text-xs text-[color:var(--gold-200)] hover:text-[color:var(--gold-100)] mb-3"
          >
            <ArrowRight size={14} /> חזרה לטיול
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[color:var(--gold-300)] mb-1">
                תכנון טיול · {trip.destination}
              </div>
              <h1 className="font-serif text-3xl md:text-4xl text-[color:var(--gold-100)]">
                {trip.name}
              </h1>
              <p className="text-sm text-foreground/70 mt-2">
                {days.length} ימים · {trip.start_date} → {trip.end_date}
              </p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-l from-[color:var(--gold-700)] to-[color:var(--gold-500)] text-white font-medium shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
            >
              <Sparkles size={18} />
              {hasAnyPlan ? "תכנן מחדש עם AI" : "תכנון טיול עם AI"}
            </button>
          </div>
        </div>
      </div>

      {/* Day cards */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {!hasAnyPlan && (
          <div className="rounded-3xl border border-dashed border-[color:var(--gold-500)]/30 bg-[color:var(--gold-500)]/5 p-8 text-center">
            <Sparkles className="mx-auto text-[color:var(--gold-400)] mb-3" size={32} />
            <h3 className="font-serif text-xl text-[color:var(--gold-100)] mb-2">
              מוכנים לתכנון אוטומטי?
            </h3>
            <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
              ענו על 5 שאלות קצרות (קצב, תחומי עניין, תחבורה, זמנים, אוכל) ונבנה לכם תוכנית מותאמת לכל יום של הטיול.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[color:var(--gold-600)] text-white text-sm font-medium"
            >
              <Sparkles size={14} /> התחל
            </button>
          </div>
        )}

        {days.map((day, i) => (
          <DayCard
            key={day.id}
            day={day}
            tripId={trip.id}
            index={i}
            adopting={adopting}
            onAdopt={(item, idx) => adoptItem(day, item, idx)}
            onAdoptAll={() => adoptAllForDay(day)}
          />
        ))}
      </div>

      {wizardOpen && (
        <PlanWizard
          tripId={trip.id}
          initialPreferences={trip.preferences}
          onClose={() => setWizardOpen(false)}
          onGenerated={() => {
            setWizardOpen(false);
            refreshDays();
          }}
        />
      )}
    </div>
  );
}

function DayCard({
  day,
  tripId,
  index,
  adopting,
  onAdopt,
  onAdoptAll,
}: {
  day: TripDay;
  tripId: string;
  index: number;
  adopting: string | null;
  onAdopt: (item: PlanItem, idx: number) => void;
  onAdoptAll: () => void;
}) {
  const plan = (day.generated_plan ?? []) as PlanItem[];
  const bookings = (day.bookings ?? []) as DayBooking[];
  const d = new Date(day.date);
  const weekday = d.toLocaleDateString("he-IL", { weekday: "long" });
  const dayLabel = d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-[color:var(--gold-500)]/20 bg-[color:var(--card)] overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[color:var(--gold-400)]" />
            <span className="font-serif text-lg text-[color:var(--gold-100)]">{weekday}</span>
            <span className="text-xs text-foreground/60">· {dayLabel}</span>
            {day.hebrew_date && (
              <span className="text-[11px] text-foreground/50">· {day.hebrew_date}</span>
            )}
          </div>
          <div className="text-[11px] text-foreground/50 mt-0.5">
            {bookings.length} משוריינים · {plan.filter((p) => p.type === "attraction").length} הצעות AI
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.length > 0 && (
            <button
              onClick={onAdoptAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[color:var(--gold-600)]/20 text-[color:var(--gold-100)] text-xs font-medium hover:bg-[color:var(--gold-600)]/30 transition"
            >
              <Check size={12} /> אמץ הכל
            </button>
          )}
          <Link
            href={`/trip/${tripId}/itinerary/${day.id}`}
            className="inline-flex items-center gap-1 text-xs text-[color:var(--gold-200)] hover:text-[color:var(--gold-100)]"
          >
            פתח יום <ChevronLeft size={12} />
          </Link>
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="px-4 py-6 text-xs text-foreground/50 text-center">
          עדיין אין הצעות AI ליום זה. לחצו "תכנון טיול עם AI" למעלה.
        </div>
      ) : (
        <ol className="divide-y divide-white/5">
          {plan.map((item, idx) => (
            <PlanItemRow
              key={idx}
              item={item}
              adopting={adopting === `${day.id}-${idx}`}
              alreadyAdopted={
                item.type === "attraction" &&
                bookings.some(
                  (b) => b.attraction_id === item.attraction_id || b.name === item.title
                )
              }
              onAdopt={() => onAdopt(item, idx)}
            />
          ))}
        </ol>
      )}
    </motion.div>
  );
}

function PlanItemRow({
  item,
  adopting,
  alreadyAdopted,
  onAdopt,
}: {
  item: PlanItem;
  adopting: boolean;
  alreadyAdopted: boolean;
  onAdopt: () => void;
}) {
  const typeMeta: Record<string, { icon: string; color: string }> = {
    attraction: { icon: "📍", color: "var(--gold-500)" },
    meal: { icon: "🍽️", color: "#5A6B3C" },
    travel: { icon: "🚗", color: "var(--sapphire-800)" },
    rest: { icon: "😴", color: "#6b7280" },
  };
  const meta = typeMeta[item.type] ?? typeMeta.attraction;

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full grid place-items-center text-sm flex-shrink-0"
        style={{ background: `${meta.color}22`, color: meta.color }}
      >
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-foreground/60 mb-0.5">
          <Clock size={10} />
          <span className="tabular-nums">{item.time}</span>
          {item.duration_min && <span>· כ-{item.duration_min} דק׳</span>}
        </div>
        <div className="text-sm font-medium text-[color:var(--gold-100)] leading-tight">
          {item.title}
        </div>
        {item.description && (
          <div className="text-xs text-foreground/70 mt-0.5 line-clamp-2">{item.description}</div>
        )}
        {item.vendor?.name && (
          <div className="mt-2 p-2 rounded-lg bg-[color:var(--gold-900)]/20 border border-[color:var(--gold-500)]/15 text-[11px]">
            <div className="flex items-center gap-1.5 text-[color:var(--gold-200)]">
              <MapPin size={10} />
              <span className="font-medium">{item.vendor.name}</span>
              {!item.verified && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 mr-auto">
                  לא מאומת — אמת לפני הזמנה
                </span>
              )}
            </div>
            {item.vendor.phone && (
              <a href={`tel:${item.vendor.phone}`} className="block text-foreground/70 mt-0.5">
                📞 {item.vendor.phone}
              </a>
            )}
          </div>
        )}
      </div>
      {item.type === "attraction" && (
        <button
          onClick={onAdopt}
          disabled={adopting || alreadyAdopted}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            alreadyAdopted
              ? "bg-[color:var(--olive-500)]/20 text-[color:var(--olive-200)] cursor-default"
              : "bg-[color:var(--gold-600)]/20 text-[color:var(--gold-100)] hover:bg-[color:var(--gold-600)]/30"
          }`}
        >
          {alreadyAdopted ? (
            <>
              <Check size={12} /> מאומץ
            </>
          ) : (
            <>
              <Plus size={12} /> אמץ
            </>
          )}
        </button>
      )}
    </li>
  );
}
