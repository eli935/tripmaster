"use client";

import { motion } from "framer-motion";
import type { Zmanim, DisplayField } from "@/lib/halacha/zmanim";
import { getDisplayFields, FIELD_LABELS } from "@/lib/halacha/zmanim";
import type { DayType } from "@/lib/supabase/types";

interface ZmanimCardProps {
  zmanim: Zmanim | null;
  dayType: DayType;
  compact?: boolean;
}

/**
 * Premium zmanim display card.
 * - Highlighted for candle-lighting and havdalah (primary times)
 * - Grid of secondary times below
 * - Dark theme with gradient accents
 */
export function ZmanimCard({ zmanim, dayType, compact = false }: ZmanimCardProps) {
  if (!zmanim) {
    return (
      <div className="rounded-xl glass p-3 text-xs text-muted-foreground">
        זמני הלכה לא זמינים (אין coordinates ליעד)
      </div>
    );
  }

  const fields = getDisplayFields(dayType);
  const primary = fields.filter(
    (f) => f === "candle_lighting" || f === "havdalah"
  );
  const secondary = fields.filter(
    (f) => f !== "candle_lighting" && f !== "havdalah"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl glass overflow-hidden"
    >
      {/* Primary highlight (candle/havdalah) */}
      {primary.length > 0 && (
        <div className="gradient-blue text-white px-4 py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {primary.map((f) => {
              const val = zmanim[f as keyof Zmanim];
              if (!val || val === "—") return null;
              return (
                <div key={f} className="flex flex-col">
                  <span className="text-[10px] text-white/70">{FIELD_LABELS[f]}</span>
                  <span className="text-lg font-bold tracking-wide" dir="ltr">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Secondary times grid */}
      {!compact && secondary.length > 0 && (
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {secondary.map((f) => {
            const val = zmanim[f as keyof Zmanim];
            if (!val || val === "—") return null;
            return (
              <div
                key={f}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03]"
              >
                <span className="text-muted-foreground truncate">{FIELD_LABELS[f]}</span>
                <span className="font-mono font-medium" dir="ltr">
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hebrew date + parsha footer */}
      {(zmanim.hebrew_date || zmanim.parsha) && (
        <div className="px-3 pb-2 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
          {zmanim.hebrew_date && <span>{zmanim.hebrew_date}</span>}
          {zmanim.parsha && <span>· פרשת {zmanim.parsha}</span>}
          <span className="ml-auto opacity-50">Hebcal.com</span>
        </div>
      )}
    </motion.div>
  );
}
