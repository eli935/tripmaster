"use client";

import { Card, CardContent } from "@/components/ui/card";
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
    <Card className={`border ${banner.color}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{banner.emoji}</span>
          <div>
            <div className="font-semibold text-sm">{banner.title} — תזכורות</div>
            <ul className="mt-1 space-y-0.5">
              {banner.reminders.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1">
                  <span>•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
