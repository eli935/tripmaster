"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, Flame, MapIcon } from "lucide-react";
import { Timeline, buildTimeline } from "@/components/itinerary/timeline";
import { DayMap, type MapPin } from "@/components/itinerary/day-map";
import { ExportActions } from "@/components/itinerary/export-actions";
import { CATEGORY_THEME, type AttractionCategory } from "@/lib/destinations";
import type { Trip, TripDay, DayBooking, Meal } from "@/lib/supabase/types";

const DAY_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> | null; bg: string; fg: string }> = {
  chol: { label: "", icon: null, bg: "", fg: "" },
  shabbat: { label: "שבת קודש · אין נסיעות", icon: Flame, bg: "linear-gradient(90deg,#1B3A6B,#0f2548)", fg: "#EACB85" },
  chag: { label: "חג", icon: Sparkles, bg: "linear-gradient(90deg,#8B2E3C,#6b2030)", fg: "#F3E7C1" },
  shabbat_chol_hamoed: { label: "שבת חול המועד", icon: Flame, bg: "linear-gradient(90deg,#1B3A6B,#5A6B3C)", fg: "#EACB85" },
  chol_hamoed: { label: "חול המועד", icon: Sparkles, bg: "linear-gradient(90deg,#5A6B3C,#3d4a28)", fg: "#F5EFD8" },
  erev_chag: { label: "ערב חג · הכנות", icon: Sparkles, bg: "linear-gradient(90deg,#8B2E3C,#B08B3F)", fg: "#fff" },
};

function formatGregorian(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatDayLabel(date: string, hebrewDate?: string): string {
  try {
    const d = new Date(date);
    const weekday = d.toLocaleDateString("he-IL", { weekday: "long" });
    return `${weekday} · ${hebrewDate || formatGregorian(date)}`;
  } catch {
    return hebrewDate || date;
  }
}

export function ItineraryClient({
  trip,
  day,
  meals,
  allDays,
}: {
  trip: Trip;
  day: TripDay;
  meals: Meal[];
  allDays: { id: string; date: string; hebrew_date: string; day_type: string }[];
}) {
  const bookings = (day.bookings ?? []) as DayBooking[];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const events = useMemo(() => buildTimeline(bookings, meals), [bookings, meals]);

  const pins: MapPin[] = useMemo(() => {
    const list: MapPin[] = [];
    events.forEach((ev, i) => {
      if (ev.kind === "attraction") {
        const b = ev.booking;
        if (typeof b.lat === "number" && typeof b.lng === "number") {
          const cat = (b.category ?? "historic") as AttractionCategory;
          const theme = CATEGORY_THEME[cat] ?? CATEGORY_THEME.historic;
          list.push({
            id: ev.id,
            lat: b.lat,
            lng: b.lng,
            color: theme.color,
            label: b.name,
            order: i + 1,
          });
        }
      } else if (ev.kind === "meal") {
        const m = ev.meal;
        if (typeof m.location_lat === "number" && typeof m.location_lng === "number") {
          list.push({
            id: ev.id,
            lat: m.location_lat,
            lng: m.location_lng,
            color: "#5A6B3C",
            label: m.location_name || m.name || "ארוחה",
            order: i + 1,
          });
        }
      }
    });
    return list;
  }, [events]);

  const dayIndex = allDays.findIndex((d) => d.id === day.id);
  const prevDay = dayIndex > 0 ? allDays[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < allDays.length - 1 ? allDays[dayIndex + 1] : null;
  const dayNumber = dayIndex + 1;

  const ribbon = DAY_TYPE_META[day.day_type] ?? DAY_TYPE_META.chol;
  const heroImage =
    bookings.find((b) => b.image_url)?.image_url ||
    "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200&q=75";

  const dayTitle = formatDayLabel(day.date, day.hebrew_date);
  const summary = [
    bookings.length ? `${bookings.length} אתרים` : null,
    meals.length ? `${meals.length} ארוחות` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Hero */}
      <div className="relative h-56 md:h-72 overflow-hidden print:h-auto print:bg-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/70 to-transparent" />

        <div className="relative h-full max-w-6xl mx-auto px-4 md:px-8 flex items-end pb-6">
          <Link
            href={`/trip/${trip.id}`}
            className="absolute top-4 right-4 md:right-8 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[color:var(--background)]/60 backdrop-blur-md border border-[color:var(--gold-500)]/20 text-xs text-[color:var(--gold-100)] hover:bg-[color:var(--background)]/80 transition print:hidden"
          >
            <ArrowRight size={14} /> חזרה לטיול
          </Link>

          <div>
            <div className="text-[11px] text-[color:var(--gold-300)] font-medium tracking-wide uppercase mb-1">
              יום {dayNumber} · {trip.destination}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-serif text-3xl md:text-5xl text-[color:var(--gold-100)] leading-tight"
            >
              {dayTitle}
            </motion.h1>
            {summary && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--gold-900)]/40 border border-[color:var(--gold-500)]/20 text-xs text-[color:var(--gold-200)] tabular-nums">
                {summary}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day-type ribbon */}
      {ribbon.icon && (
        <div
          className="py-2 px-4 md:px-8 text-center text-sm font-medium tracking-wide flex items-center justify-center gap-2"
          style={{ background: ribbon.bg, color: ribbon.fg }}
        >
          <ribbon.icon size={14} />
          {ribbon.label}
        </div>
      )}

      {/* Day nav + export actions */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          {prevDay && (
            <Link
              href={`/trip/${trip.id}/itinerary/${prevDay.id}`}
              className="p-2 rounded-lg border border-[color:var(--gold-500)]/20 text-[color:var(--gold-100)] hover:bg-[color:var(--gold-500)]/10 transition"
              aria-label="יום קודם"
            >
              <ArrowRight size={16} />
            </Link>
          )}
          {nextDay && (
            <Link
              href={`/trip/${trip.id}/itinerary/${nextDay.id}`}
              className="p-2 rounded-lg border border-[color:var(--gold-500)]/20 text-[color:var(--gold-100)] hover:bg-[color:var(--gold-500)]/10 transition"
              aria-label="יום הבא"
            >
              <ArrowLeft size={16} />
            </Link>
          )}
        </div>
        <ExportActions events={events} dayTitle={dayTitle} />
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-16 print:pb-0">
        <div className="md:grid md:grid-cols-[1fr_1fr] md:gap-8">
          {/* Timeline */}
          <div className="md:order-2">
            <Timeline
              events={events}
              activeId={activeId}
              onHover={setActiveId}
              dayType={day.day_type}
            />
          </div>

          {/* Map (desktop sticky) */}
          {pins.length > 0 && (
            <div className="hidden md:block md:order-1 print:hidden">
              <div className="sticky top-4 rounded-3xl overflow-hidden border border-[color:var(--gold-300)]/30 shadow-xl">
                <DayMap
                  pins={pins}
                  activeId={activeId}
                  onPinClick={(id) => setActiveId(id)}
                  className="w-full h-[calc(100vh-140px)] min-h-[520px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile floating map button */}
      {pins.length > 0 && (
        <>
          <button
            onClick={() => setMapOpen(true)}
            className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[color:var(--gold-700)] text-white text-sm font-medium shadow-2xl hover:bg-[color:var(--gold-600)] transition print:hidden"
          >
            <MapIcon size={16} />
            מפה · {pins.length} נקודות
          </button>

          {mapOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 bg-[color:var(--background)]/90 backdrop-blur-sm flex items-end print:hidden"
              onClick={() => setMapOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28 }}
                className="w-full h-[75vh] bg-[color:var(--card)] rounded-t-3xl overflow-hidden border-t border-[color:var(--gold-500)]/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center py-2">
                  <div className="w-10 h-1 rounded-full bg-[color:var(--gold-500)]/40" />
                </div>
                <DayMap
                  pins={pins}
                  activeId={activeId}
                  onPinClick={(id) => {
                    setActiveId(id);
                    setMapOpen(false);
                  }}
                  className="w-full h-full"
                />
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .maplibregl-map, button, nav, a[href^="/"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
