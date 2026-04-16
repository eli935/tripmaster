# TripMaster — אפליקציית תכנון טיולים משפחתיים

## מטרת הפרויקט
אפליקציית ווב+מובייל (PWA) לתכנון טיולים משפחתיים בחו"ל, עם דגש על משפחות חרדיות.
מנהלת: משתתפים, ציוד לפי חג, תכנון ארוחות עם לוח עברי, רשימת קניות, חלוקת תשלומים, צ'אט פנימי, והפקת לקחים.

**Production:** https://tripmaster-seven.vercel.app
**Version:** v8.1
**User:** אלי רוזנפלד (eli@biglog.co.il) — super_admin

## Language
The user speaks Hebrew. Respond in Hebrew unless asked otherwise.

---

## 🏢 Agent Hierarchy

This project uses a team of specialized AI agents. **Always start with the manager.**

### Master Coordinator
- **`tripmaster-manager`** (opus) — high-level planning, orchestrates sub-agents, understands the full system

### Specialized Sub-Agents

| Agent | Domain | Model |
|---|---|---|
| `destinations-expert` | Chabad houses, kosher restaurants, attractions, Google Maps, Waze, Unsplash | sonnet |
| `financial-expert` | Expenses, multi-payer, balances, minimize transfers, currency | sonnet |
| `logistics-expert` | Equipment, shopping lists, meal planning, packing | sonnet |
| `halacha-expert` | Hebrew calendar, Shabbat/Chag rules, kashrut | opus |
| `ui-designer` | Dark theme, animations, glass morphism, responsive | sonnet |
| `database-expert` | Supabase schema, RLS, migrations, query performance | sonnet |

### How It Works
1. User asks a question → `tripmaster-manager` receives it
2. Manager classifies the task → delegates to specialist(s)
3. Specialists do their work → report back
4. Manager integrates results → responds to user

**You don't need to manually invoke agents** — they trigger proactively based on their `description` field. The manager orchestrates.

---

## Tech Stack

| שכבה | טכנולוגיה |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui |
| Animations | framer-motion |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI | @anthropic-ai/sdk (destination auto-generation) |
| Hebrew Calendar | @hebcal/core |
| Hosting | Vercel (auto-deploy on git push) |

## הפעלה

```bash
cd C:\Users\User\Downloads\tripmaster
npm install
npm run dev
# → http://localhost:3000
```

## Deploy Flow
```bash
npx --package=typescript tsc --noEmit  # type check
npm run build
git add -A
git commit -m "vX.Y: description"
git push   # auto-deploys to Vercel
```

## משתני סביבה (.env.local + Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://cwmeftixlaeyiskrbyve.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Project Structure

```
tripmaster/
├── .claude/
│   └── agents/              ← THE AGENT TEAM
│       ├── tripmaster-manager.md    (master)
│       ├── destinations-expert.md
│       ├── financial-expert.md
│       ├── logistics-expert.md
│       ├── halacha-expert.md
│       ├── ui-designer.md
│       └── database-expert.md
├── app/
│   ├── layout.tsx           RTL + Rubik + Sonner
│   ├── login/               Magic link
│   ├── profile/             Family profile
│   ├── dashboard/           Trip list + create
│   ├── trip/[id]/           Main trip (11 tabs):
│   │                        destination, overview, chat,
│   │                        meals, equipment, shopping,
│   │                        expenses, files, lessons,
│   │                        summary, admin, settings
│   ├── invite/[tripId]/
│   └── api/whatsapp/
├── components/
│   ├── app-shell.tsx        Header + nav
│   ├── motion.tsx           Reusable framer-motion components
│   ├── holiday-banner.tsx
│   └── ui/                  shadcn components
├── lib/
│   ├── supabase/            client/server/middleware/types
│   ├── destinations.ts      Static destination DB
│   ├── destination-generator.ts  AI-powered generation
│   ├── currency.ts          Live exchange rates
│   ├── hebrew-calendar.ts
│   ├── expense-calculator.ts     Balance + minimize transfers
│   ├── shopping-generator.ts
│   ├── permissions.ts       4 roles × 16 permissions
│   ├── soft-delete.ts       Delete with admin approval
│   ├── file-upload.ts
│   ├── whatsapp.ts
│   ├── types-v8.ts          Multi-payer, audit, messages, versions
│   └── hooks/use-realtime.ts
├── supabase/migrations/     Full schema history (001-004)
├── middleware.ts
└── CLAUDE.md               ← you are here
```

---

## DB Schema (v8.1) — 18 Tables

**Core:** profiles, trips, trip_participants, trip_permissions, equipment_templates
**Trip content:** trip_days, meals, meal_items, trip_equipment, shopping_items, lessons_learned
**Money:** expenses, expense_payers, expense_splits
**Social/Admin:** trip_messages, trip_files, audit_log, app_versions, destinations_cache

All with soft delete on user content. RLS currently disabled (re-enable before prod).

---

## Current Feature Set (v8.1)

✅ **Destination Intelligence** — static DB + AI-generated cache
✅ **Multi-payer expenses** — 1 expense → N payers with different amounts
✅ **Soft delete** with admin approval + full audit log
✅ **Trip chat** — realtime via Supabase
✅ **Granular permissions** — 4 roles × 16 permissions per user
✅ **Hebrew calendar** — auto day-type detection
✅ **Shopping list auto-gen** from meal ingredients
✅ **File uploads** — camera + picker, 8 categories
✅ **Version history** — v1.0 → v8.1 with changelogs
✅ **Live currency** via Frankfurter API
✅ **Dark premium UI** inspired by wearebrand.io

---

## Conventions

- **RTL Hebrew UI** — `dir="rtl"` on `<html>`, use `ml-*` for icons
- **Dark theme first** — always use CSS variables, never hardcoded colors
- **Glass morphism** — `.glass` + `.glass-hover` utility classes
- **Gradients** — `.gradient-blue`, `.gradient-purple`, etc.
- **Animations** — spring ease `[0.16, 1, 0.3, 1]`, max 0.8s
- **Parallel queries** — always `Promise.all` for independent fetches
- **Soft delete filtering** — `.is('deleted_at', null)` on all user content
- **Images** — Unsplash `?w=600&q=75` for cards

---

## Initial Supabase Setup

1. Create project at supabase.com
2. Run migrations in order: 001 → 002 → 003 → 004
3. Enable Realtime on: `trip_participants`, `trip_equipment`, `shopping_items`, `expenses`, `meals`, `trip_messages`
4. Add `trip-files` storage bucket (public, 50MB)
5. Set super_admin: `UPDATE profiles SET is_super_admin = true WHERE id = '...'`
