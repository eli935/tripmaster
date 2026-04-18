"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TreePine, Landmark, Waves, Building2, Zap, Binoculars, Star, Smile,
  MapPin, Clock, Globe, Navigation, ChevronDown, ChevronUp,
  UtensilsCrossed, Coffee, Moon, Users,
} from "lucide-react";
import { useState } from "react";
import type { DayBooking, Meal } from "@/lib/supabase/types";
import {
  CATEGORY_THEME,
  MEAL_TYPE_DEFAULT_TIME,
  MEAL_TYPE_LABEL,
  buildWazeLink,
  buildGmapsLink,
  type AttractionCategory,
} from "@/lib/destinations";

const CAT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  TreePine, Landmark, Waves, Building2, Zap, Binoculars, Star, Smile,
};

const MEAL_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  dinner: Moon,
  seuda_1: UtensilsCrossed,
  seuda_2: UtensilsCrossed,
  seuda_3: UtensilsCrossed,
};

export type TimelineEvent =
  | { kind: "attraction"; id: string; time: string; booking: DayBooking }
  | { kind: "meal"; id: string; time: string; meal: Meal };

export function buildTimeline(bookings: DayBooking[], meals: Meal[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const b of bookings) {
    const time = b.time ?? "12:00";
    events.push({ kind: "attraction", id: b.booking_id ?? b.attraction_id ?? b.attraction_name, time, booking: b });
  }
  for (const m of meals) {
    const time = m.time ?? MEAL_TYPE_DEFAULT_TIME[m.meal_type] ?? "12:00";
    events.push({ kind: "meal", id: m.id, time, meal: m });
  }
  events.sort((a, b) => a.time.localeCompare(b.time));
  return events;
}

export function Timeline({
  events,
  activeId,
  onHover,
  dayType,
}: {
  events: TimelineEvent[];
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  dayType?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-[color:var(--gold-100)]/10 border border-[color:var(--gold-400)]/30 grid place-items-center mb-4">
          <MapPin className="text-[color:var(--gold-500)]" size={28} />
        </div>
        <h3 className="font-serif text-xl text-[color:var(--gold-100)] mb-2">היום הזה עוד ריק</h3>
        <p className="text-sm text-foreground/60 max-w-sm">
          {dayType === "shabbat" || dayType === "chag"
            ? "הוסיפו ארוחות וזמני תפילה לתוכניה"
            : "הוסיפו אתרים וארוחות כדי לבנות את התוכניה"}
        </p>
      </div>
    );
  }

  return (
    <ol className="relative pr-8 space-y-4" dir="rtl">
      {/* Gold rail on the right */}
      <div
        aria-hidden
        className="absolute top-3 bottom-3 right-3 w-0.5 bg-gradient-to-b from-[color:var(--gold-500)]/50 via-[color:var(--gold-500)]/30 to-transparent"
      />

      <AnimatePresence initial={false}>
        {events.map((ev, i) => (
          <motion.li
            key={ev.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            onMouseEnter={() => onHover?.(ev.id)}
            onMouseLeave={() => onHover?.(null)}
            className="relative"
          >
            <TimelineRow event={ev} active={activeId === ev.id} order={i + 1} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function TimelineRow({
  event,
  active,
  order,
}: {
  event: TimelineEvent;
  active: boolean;
  order: number;
}) {
  if (event.kind === "attraction") {
    return <AttractionRow booking={event.booking} time={event.time} order={order} active={active} />;
  }
  return <MealRow meal={event.meal} time={event.time} order={order} active={active} />;
}

function TimeBubble({ time, estimated }: { time: string; estimated?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums
        bg-[color:var(--gold-900)]/20 text-[color:var(--gold-100)]
        ${estimated ? "border border-dashed border-[color:var(--gold-500)]/40" : ""}`}
      title={estimated ? "שעה משוערת" : undefined}
    >
      <Clock size={10} />
      {time.slice(0, 5)}
    </span>
  );
}

function Node({ color, number, icon: Icon, active }: { color: string; number: number; icon: React.ComponentType<{ size?: number; className?: string }>; active: boolean }) {
  return (
    <div
      className={`absolute right-0 top-3 w-11 h-11 rounded-full grid place-items-center border-2 border-[color:var(--background)] shadow-lg
        ${active ? "ring-4 ring-[color:var(--gold-500)]/30" : ""}
        transition-all`}
      style={{ background: color }}
    >
      <Icon size={18} className="text-white" />
      <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[color:var(--background)] text-[9px] grid place-items-center text-[color:var(--gold-100)] font-bold border border-[color:var(--gold-500)]/50">
        {number}
      </span>
    </div>
  );
}

function AttractionRow({
  booking,
  time,
  order,
  active,
}: {
  booking: DayBooking;
  time: string;
  order: number;
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = (booking.category ?? "historic") as AttractionCategory;
  const theme = CATEGORY_THEME[cat] ?? CATEGORY_THEME.historic;
  const Icon = CAT_ICONS[theme.icon] ?? Landmark;
  const estimated = !booking.time;
  const waze = booking.waze_url ?? buildWazeLink(booking.lat, booking.lng, booking.name);
  const gmaps = booking.gmaps_url ?? buildGmapsLink(booking.lat, booking.lng, booking.name);

  return (
    <div className="mr-14 relative">
      <Node color={theme.color} number={order} icon={Icon} active={active} />

      <motion.div
        layout
        className={`rounded-2xl border bg-[color:var(--card)] overflow-hidden
          ${active ? "border-[color:var(--gold-500)]/60 shadow-xl shadow-[color:var(--gold-500)]/10" : "border-[color:var(--gold-300)]/20"}
          transition-all`}
      >
        <div className="p-4 flex gap-3 items-start">
          {booking.image_url && (
            <motion.img
              layoutId={`img-${booking.booking_id}`}
              src={booking.image_url}
              alt={booking.name}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-[color:var(--gold-400)]/20"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-serif text-base leading-tight text-[color:var(--gold-100)] line-clamp-2">
                {booking.name}
              </h3>
              <TimeBubble time={time} estimated={estimated} />
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: `${theme.color}22`, color: theme.color }}
              >
                {theme.label}
              </span>
              {booking.duration_minutes && (
                <span className="text-[10px] text-foreground/60 inline-flex items-center gap-1">
                  <Clock size={10} /> כ־{booking.duration_minutes} דק׳
                </span>
              )}
            </div>
            {booking.description && (
              <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed">
                {booking.description}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2">
              {booking.website_url && (
                <a
                  href={booking.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg hover:bg-[color:var(--gold-500)]/10 text-foreground/70 hover:text-[color:var(--gold-100)] transition"
                  aria-label="אתר רשמי"
                >
                  <Globe size={14} />
                </a>
              )}
              <a
                href={waze}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg hover:bg-[color:var(--gold-500)]/10 text-foreground/70 hover:text-[color:var(--gold-100)] transition"
                aria-label="Waze"
              >
                <Navigation size={14} />
              </a>
              <a
                href={gmaps}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg hover:bg-[color:var(--gold-500)]/10 text-foreground/70 hover:text-[color:var(--gold-100)] transition"
                aria-label="Google Maps"
              >
                <MapPin size={14} />
              </a>
              <button
                onClick={() => setExpanded((x) => !x)}
                className="p-1.5 rounded-lg hover:bg-[color:var(--gold-500)]/10 text-foreground/70 hover:text-[color:var(--gold-100)] transition mr-auto"
                aria-label={expanded ? "צמצם" : "הרחב"}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && booking.description && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-foreground/80 border-t border-[color:var(--gold-300)]/10">
                <p className="mt-3">{booking.description}</p>
                {booking.user_notes && (
                  <div className="mt-3 p-2 rounded-lg bg-[color:var(--gold-900)]/20 border border-[color:var(--gold-500)]/20">
                    <p className="text-xs text-[color:var(--gold-200)]">📝 {booking.user_notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function MealRow({
  meal,
  time,
  order,
  active,
}: {
  meal: Meal;
  time: string;
  order: number;
  active: boolean;
}) {
  const Icon = MEAL_ICONS[meal.meal_type] ?? UtensilsCrossed;
  const estimated = !meal.time;
  const label = MEAL_TYPE_LABEL[meal.meal_type] ?? meal.meal_type;

  return (
    <div className="mr-14 relative">
      <Node color="#5A6B3C" number={order} icon={Icon} active={active} />
      <div
        className={`rounded-2xl border bg-[color:var(--card)]/80 p-4
          ${active ? "border-[color:var(--olive-500)]/60" : "border-[color:var(--gold-300)]/15"}
          transition-all`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="text-[11px] text-[color:var(--olive-300)] font-medium mb-0.5">
              {label}
            </div>
            <h3 className="font-serif text-base text-[color:var(--gold-100)] leading-tight">
              {meal.name || "ארוחה"}
            </h3>
          </div>
          <TimeBubble time={time} estimated={estimated} />
        </div>
        {meal.description && (
          <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{meal.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-foreground/60">
          {meal.attendees_count && (
            <span className="inline-flex items-center gap-1">
              <Users size={11} /> {meal.attendees_count} סועדים
            </span>
          )}
          {meal.location_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} /> {meal.location_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
