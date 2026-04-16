"use client";

import type { HolidayType } from "@/lib/supabase/types";

const HOLIDAY_BANNERS: Partial<Record<HolidayType, {
  emoji: string;
  title: string;
  reminders: string[];
  color: string;
}>> = {
  pesach: {
    emoji: "🫓",
    title: "טיול פסח",
    reminders: [
      "כל המזון חייב להיות כשר לפסח",
      "תנור + פלטה + כלים נפרדים",
      "מצות שמורות — לפחות 3 ק\"ג לנפש",
      "הגדות + קערת סדר + יין לארבע כוסות",
      "בדיקת חמץ + ביטול + שריפה",
      "לוודא שהדירה נקייה מחמץ",
    ],
    color: "bg-amber-50 border-amber-200",
  },
  sukkot: {
    emoji: "🌿",
    title: "טיול סוכות",
    reminders: [
      "סוכה + סכך + דפנות — לוודא שאפשר להקים ביעד",
      "ארבעת המינים — לולב, אתרוג, הדסים, ערבות",
      "לולב לכל מבוגר (נשים פטורות אך רבות נוהגות)",
      "בדיקת כשרות אתרוג לפני הנסיעה",
      "נויי סוכה + תאורה",
      "שולחן + כיסאות מתקפלים לסוכה",
    ],
    color: "bg-green-50 border-green-200",
  },
  rosh_hashana: {
    emoji: "🍎",
    title: "טיול ראש השנה",
    reminders: [
      "סימנים לליל ראש השנה (תפוח בדבש, רימון, דגים...)",
      "דבש + רימונים + תמרים",
      "שופר (לפחות אחד לקבוצה)",
      "מחזורים לתפילה",
    ],
    color: "bg-red-50 border-red-200",
  },
  shavuot: {
    emoji: "🥛",
    title: "טיול שבועות",
    reminders: [
      "מאכלי חלב — עוגות גבינה, בלינצ'ס",
      "פרחים ונויי ירק (מנהג)",
      "תיקון ליל שבועות",
    ],
    color: "bg-blue-50 border-blue-200",
  },
};

interface HolidayBannerProps {
  holidayType: HolidayType;
}

export function HolidayBanner({ holidayType }: HolidayBannerProps) {
  const banner = HOLIDAY_BANNERS[holidayType];
  if (!banner) return null;

  return (
    <div className="rounded-2xl glass glass-hover p-4 animate-fade-in-up animate-delay-200">
      <div className="flex items-start gap-3">
        <div className="text-3xl animate-float">{banner.emoji}</div>
        <div>
          <div className="font-semibold text-sm">{banner.title}</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {banner.reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="text-blue-400 mt-0.5">›</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
