# Stage 6 — Strict File Uploads | v1.0 | 2026-04-17 15:04

## סיכום (עברית)

יושמה העלאת קבצים מחמירה עם **3 שדות חובה**: קובץ, תיאור, ותמונה ממוזערת.

### שינויים

**`lib/file-upload.ts`**
- נוספה פונקציה חדשה `uploadThumbnail(imageFile, tripId)` — מעלה תמונה ממוזערת ל-Storage בנתיב `<tripId>/thumbs/` ומחזירה URL ציבורי.
- `uploadTripFile` שונתה: הפרמטרים `description` ו-`imageUrl` הם כעת **חובה** (לא אופציונליים). ולידציה בצד הלקוח: אם `description.trim().length === 0` או `imageUrl` ריק → ה-INSERT נחסם ומוחזר `null`.
- `TripFile.description` שונה ל-`string` (לא `string | null`), נוסף `image_url: string | null` (null לרשומות ישנות).

**`app/trip/[id]/file-manager.tsx`** (נכתב מחדש)
- מצב טופס: `pendingFiles`, `thumbFile`, `thumbPreview`, `description`, `showErrors`.
- הטופס עכשיו חסום: כפתור "העלה קובץ" `disabled` עד שכל 3 השדות מלאים.
- כוכבית אדומה `*` וטקסט עזר על כל שדה חובה + באנר זהב שמסביר שהשדות עם `*` הם חובה.
- הודעות שגיאה מוטמעות (inline) עם אייקון `AlertCircle` לכל שדה חסר — מופיעות רק אחרי ניסיון submit.
- תצוגה מקדימה של התמונה הממוזערת בריבוע 64×64 rounded עם fallback ל-`ImagePlus`.
- זרימה: העלאת thumbnail פעם אחת → שימוש חוזר באותו URL לכל הקבצים שנבחרו בו-זמנית.

**תצוגת רשימת הקבצים**
- thumbnail 64×64 מעוגל (`rounded-xl`, `object-cover`) במקום 40×40.
- תיאור מוצג בשורה נפרדת מתחת לשם הקובץ.
- Fallback לרשומות ישנות ללא `image_url`: אייקון לפי קטגוריה (emoji) או אייקון תמונה כללי.

**ולידציה**
- Client: `canSubmit = hasFiles && hasDesc && hasThumb && !uploading`.
- "Server" (בתוך `uploadTripFile`): `description.trim().length > 0 && imageUrl.length > 0` — אחרת חוסם את ה-INSERT.

### בדיקות
- `npx tsc --noEmit` → **עבר ללא שגיאות** (EXIT=0).
- לא הוספו חבילות npm חדשות.

---

## Summary (English)

Implemented strict file uploads in TripMaster Stage 6 with 3 mandatory fields: file, description, thumbnail image.

### Changes

**`lib/file-upload.ts`**
- Added `uploadThumbnail()` that uploads an image to the `trip-files` bucket under `<tripId>/thumbs/` and returns its public URL.
- `uploadTripFile` signature tightened — `description: string` and `imageUrl: string` are now required (no longer optional). Guards at the top of the function block the DB insert if either is empty (`description.trim().length === 0` or `imageUrl` empty).
- `TripFile.description` narrowed to `string`; added `image_url: string | null` (nullable only for legacy rows).

**`app/trip/[id]/file-manager.tsx`** (rewritten)
- Form state staged locally (`pendingFiles`, `thumbFile`, `description`) — no auto-upload on file pick.
- Submit button disabled until all 3 required fields have values.
- Red asterisk `*` + helper text on every required field; gold banner explains that starred fields are required.
- Inline error messages with `AlertCircle` icon appear only after first submit attempt.
- 64×64 thumbnail preview with `ImagePlus` placeholder fallback; hover changes border to gold.
- Single thumbnail is uploaded once and reused as `image_url` for all files picked in the same batch.

**File list display**
- 64×64 rounded thumbnail (was 40×40).
- Description shown on its own line under file name.
- Fallback for legacy rows missing `image_url`: category emoji or generic image icon.

**Validation**
- Client-side: `canSubmit` gate on the submit button.
- In-handler: strict check inside `uploadTripFile` before INSERT (blocks empty description / empty image_url).

### Verification
- `npx tsc --noEmit` → **passes clean** (EXIT=0).
- No new npm packages added.
- RTL, dark theme, gold accents preserved.

### Files touched
- `C:\Users\User\Downloads\tripmaster\lib\file-upload.ts`
- `C:\Users\User\Downloads\tripmaster\app\trip\[id]\file-manager.tsx`
