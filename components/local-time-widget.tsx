"use client";

import { useEffect, useState } from "react";
import { Clock, Globe } from "lucide-react";

const IL_TZ = "Asia/Jerusalem";

function fmt(d: Date, tz: string): string {
  return d.toLocaleTimeString("he-IL", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * UTC offset in minutes for a given IANA tz at a given moment.
 * Uses Intl.DateTimeFormat with "shortOffset" where available, else a fallback
 * that parses the date twice (in tz vs. UTC) and diffs them.
 */
function tzOffsetMinutes(d: Date, tz: string): number {
  try {
    // Get the hour/minute as they would appear in the target tz
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return Math.round((asUTC - d.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function hebrewHourLabel(diffHours: number): string {
  const abs = Math.abs(diffHours);
  if (diffHours === 0) return "אותה שעה";
  const direction = diffHours > 0 ? "מקדים את ישראל" : "מפגר אחרי ישראל";
  const hourStr = abs === 1 ? "שעה" : `${abs} שעות`;
  return `${hourStr} ${direction}`;
}

export function LocalTimeWidget({
  destinationTz,
  destinationLabel,
}: {
  destinationTz: string;
  destinationLabel?: string;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const destTime = fmt(now, destinationTz);
  const ilTime = fmt(now, IL_TZ);
  const destOffset = tzOffsetMinutes(now, destinationTz);
  const ilOffset = tzOffsetMinutes(now, IL_TZ);
  const diffHours = Math.round((destOffset - ilOffset) / 60);

  return (
    <div className="rounded-2xl glass p-3 border border-[var(--gold-500)]/20">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-[var(--gold-300)] mb-2">
        <Globe className="w-3 h-3" />
        שעון
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">ישראל</div>
          <div className="font-serif text-2xl tabular-nums text-[var(--gold-100)] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[var(--gold-400)]" />
            {ilTime}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {destinationLabel || "ביעד"}
          </div>
          <div className="font-serif text-2xl tabular-nums text-[var(--gold-100)] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[var(--gold-400)]" />
            {destTime}
          </div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-foreground/70 text-center">
        היעד {hebrewHourLabel(diffHours)}
      </div>
    </div>
  );
}
