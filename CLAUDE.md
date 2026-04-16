# TripMaster — אפליקציית תכנון טיולים משפחתיים

## מטרת הפרויקט

אפליקציית ווב+מובייל (PWA) לתכנון טיולים משפחתיים בחו"ל, עם דגש על משפחות חרדיות.
מנהלת: משתתפים, ציוד לפי חג, תכנון ארוחות עם לוח עברי, רשימת קניות, חלוקת תשלומים, והפקת לקחים.

## Tech Stack

| שכבה | טכנולוגיה |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Auth | Supabase Magic Link (email) |
| Hebrew Calendar | @hebcal/core |
| WhatsApp | Baileys / Twilio API |
| PWA | next-pwa + manifest.json |

## Language
The user speaks Hebrew. Respond in Hebrew unless asked otherwise.

## הפעלה

```bash
npm install
# עדכן .env.local עם Supabase credentials
npm run dev
# → http://localhost:3000
```

## משתני סביבה (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# WhatsApp (אופציונלי)
WHATSAPP_PROVIDER=baileys
WHATSAPP_BOT_URL=http://localhost:3001/api/send
```

## מבנה קבצים

```
tripmaster/
├── app/
│   ├── layout.tsx              RTL + Rubik font + Sonner toasts
│   ├── login/page.tsx          Magic link login
│   ├── profile/                Profile editing (name, children)
│   ├── dashboard/              Trip list + create trip
│   ├── trip/[id]/              Main trip view (8 tabs)
│   ├── invite/[tripId]/        Join trip via invite link
│   └── api/whatsapp/           WhatsApp send/notify endpoints
├── components/
│   ├── app-shell.tsx           Header + nav
│   ├── holiday-banner.tsx      Pesach/Sukkot reminder banners
│   └── ui/                     shadcn components
├── lib/
│   ├── supabase/               Client/server/middleware/types
│   ├── hebrew-calendar.ts      Day type detection + meal defaults
│   ├── expense-calculator.ts   Balance + minimize transfers
│   ├── shopping-generator.ts   Aggregate meal items → shopping list
│   ├── whatsapp.ts             WhatsApp messaging + templates
│   └── hooks/use-realtime.ts   Supabase realtime subscriptions
├── supabase/migrations/        SQL schema + seed data
└── middleware.ts               Auth guard
```

## DB: 12 טבלאות

profiles, trips, trip_participants, equipment_templates, trip_equipment,
trip_days, meals, meal_items, shopping_items, expenses, expense_splits, lessons_learned.

## הגדרת Supabase

1. צור פרויקט ב-supabase.com
2. העתק URL + anon key ל-.env.local
3. הרץ את `supabase/migrations/001_initial_schema.sql` ב-SQL Editor
4. הפעל Realtime: trip_participants, trip_equipment, shopping_items, expenses, meals
