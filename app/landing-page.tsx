"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Calendar, Map, Utensils, ShoppingBag, Users, Wallet, MessageCircle,
  ArrowRight, Loader2, CheckCircle2, Globe, Star, Phone, Mail, Flame, Heart,
} from "lucide-react";

type Locale = "he" | "en";

// Premium destination imagery — curated Unsplash photography
const DESTINATIONS: Array<{
  name: { he: string; en: string };
  country: { he: string; en: string };
  img: string;
}> = [
  {
    name: { he: "סנטוריני", en: "Santorini" },
    country: { he: "יוון", en: "Greece" },
    img: "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80&auto=format",
  },
  {
    name: { he: "רומא", en: "Rome" },
    country: { he: "איטליה", en: "Italy" },
    img: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80&auto=format",
  },
  {
    name: { he: "קוטור", en: "Kotor" },
    country: { he: "מונטנגרו", en: "Montenegro" },
    img: "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=800&q=80&auto=format",
  },
  {
    name: { he: "האלפים", en: "Swiss Alps" },
    country: { he: "שווייץ", en: "Switzerland" },
    img: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=800&q=80&auto=format",
  },
  {
    name: { he: "פראג", en: "Prague" },
    country: { he: "צ׳כיה", en: "Czechia" },
    img: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80&auto=format",
  },
  {
    name: { he: "אתונה", en: "Athens" },
    country: { he: "יוון", en: "Greece" },
    img: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80&auto=format",
  },
];

const COPY = {
  he: {
    dir: "rtl" as const,
    nav: { login: "כניסה", language: "English" },
    hero: {
      tagline: "בוטיק תכנון טיולים משפחתיים",
      title: "הטיול הבא שלכם — מתוכנן בקפידה, עד הפרט האחרון",
      sub: "צוות TripMaster מלווה משפחות ישראליות בתכנון חופשות בחו״ל. ארוחות, לינה, בית חב״ד, כשרות, זמני שבת, מסלול יומי ותקציב משפחתי — הכל מנוהל במקום אחד, בליווי אישי.",
      cta: "התחילו תכנון",
      cta2: "השאירו פרטים ונחזור אליכם",
    },
    features: {
      title: "מה כולל TripMaster?",
      items: [
        { icon: Calendar, t: "לוח יומי עברי", d: "שבתות וחגים מזוהים אוטומטית, זמני תפילה/שקיעה לכל יעד, אסור/מותר ביום-יום של הטיול" },
        { icon: Sparkles, t: "תכנון AI מלא", d: "ענו על 5 שאלות וה-AI יבנה לכם סדר יום לכל יום של הטיול — אטרקציות, ארוחות, וזמני נסיעה" },
        { icon: Map, t: "מפה אינטראקטיבית", d: "המלון, כל האתרים, בית חב״ד והמסעדות — בתצוגה אחת עם ניווט ישיר לWaze" },
        { icon: Utensils, t: "תכנון ארוחות", d: "AI מייצר מתכונים מותאמים ליעד, מחשב מרכיבים לפי מספר הסועדים, ומעדכן את רשימת הקניות" },
        { icon: ShoppingBag, t: "רשימת ציוד וקניות", d: "אוטומטית לפי חג וגודל משפחה — מה לארוז מהבית, מה לקנות בחו״ל" },
        { icon: Wallet, t: "ניהול הוצאות", d: "חלוקה חכמה בין משתתפים, מינימום העברות כסף, היסטוריה מלאה" },
        { icon: Users, t: "צ׳אט קבוצתי", d: "כל המשפחה באותו מקום — עדכונים, תמונות ותיאום מהשטח" },
        { icon: MessageCircle, t: "שיתוף בוואטסאפ", d: "שולחים את סדר היום המלא לקבוצה בלחיצה אחת" },
      ],
    },
    religious: {
      title: "בנוי למשפחות דתיות — מהקרקע עד התקרה",
      items: [
        { icon: Flame, t: "שבת וחג", d: "המערכת מזהה אוטומטית ומונעת הצעות של רכב, קניות או פעילויות בתשלום בימים קדושים" },
        { icon: Star, t: "בית חב״ד", d: "מיקום, טלפון, שעות תפילה, אפשרויות לינה וסעודה — עבור כל יעד במאגר" },
        { icon: Utensils, t: "כשרות", d: "מסעדות כשרות, חנויות מוצרים כשרים, והכשרת מטבח בדירה שכורה" },
        { icon: Heart, t: "זמני הלכה", d: "זמני תפילה, שקיעה, צאת השבת — מחושב לפי היעד הספציפי שלכם" },
      ],
    },
    how: {
      title: "איך זה עובד",
      steps: [
        { n: 1, t: "השאירו פרטים", d: "יעד, תאריכים, הרכב המשפחה — שאלון קצר של דקה" },
        { n: 2, t: "נחזור אליכם", d: "הצוות שלנו יוצר איתכם קשר תוך 24 שעות לשיחת היכרות — מה חשוב לכם, מה התקציב, מה המרקם של המשפחה" },
        { n: 3, t: "תכנון בשיתוף", d: "אנחנו בונים ביחד את הטיול. אתם בוחרים מתוך הצעות מדויקות, אנחנו דואגים לכל הפרטים הקטנים" },
        { n: 4, t: "טיול בראש שקט", d: "אפליקציה בידיים, כל המידע זמין תמיד, והצוות שלנו זמין לכם אם צריך עזרה גם בשטח" },
      ],
    },
    form: {
      title: "השאירו פרטים — נחזור אליכם תוך 24 שעות",
      sub: "שיחת היכרות ללא התחייבות וללא עלות, להבנת הצרכים של המשפחה שלכם",
      name: "שם מלא",
      email: "אימייל",
      phone: "טלפון (עדיף וואטסאפ)",
      destination: "יעד הטיול",
      destinationPh: "רומא / אתונה / מונטנגרו / אחר",
      startDate: "תאריך יציאה",
      endDate: "תאריך חזרה",
      adults: "מבוגרים",
      children: "ילדים",
      message: "משהו שכדאי שנדע מראש?",
      messagePh: "אלרגיות, העדפות, נסיבות מיוחדות...",
      submit: "שלח פרטים",
      sending: "שולח...",
      success: "תודה! קיבלנו את הפרטים שלכם ונחזור אליכם תוך 24 שעות.",
      error: "שגיאה בשליחה — אפשר לנסות שוב או לשלוח ישירות ל-eli@biglog.co.il",
      required: "שדה חובה",
    },
    footer: {
      built: "TripMaster · בוטיק תכנון טיולים משפחתיים",
      contact: "יצירת קשר: eli@biglog.co.il",
    },
  },
  en: {
    dir: "ltr" as const,
    nav: { login: "Log in", language: "עברית" },
    hero: {
      tagline: "Boutique family trip planning",
      title: "Your next trip — planned with care, down to the last detail",
      sub: "The TripMaster team guides Israeli families through international trip planning. Meals, accommodation, Chabad houses, kosher logistics, Shabbat timing, daily itinerary and family budget — all managed in one place, with personal concierge support.",
      cta: "Start planning",
      cta2: "Leave your details and we'll reach out",
    },
    features: {
      title: "What's in TripMaster?",
      items: [
        { icon: Calendar, t: "Hebrew Daily Calendar", d: "Shabbat & holidays auto-detected, prayer / sunset times per destination, day-by-day religious awareness" },
        { icon: Sparkles, t: "Full AI Planning", d: "Answer 5 questions and AI builds your day-by-day itinerary — attractions, meals, travel times" },
        { icon: Map, t: "Interactive Map", d: "Your hotel, all attractions, Chabad house, restaurants — one view, direct Waze navigation" },
        { icon: Utensils, t: "Meal Planning", d: "AI generates recipes matched to the destination, calculates ingredients by headcount, updates the shopping list" },
        { icon: ShoppingBag, t: "Packing & Shopping", d: "Automatic by holiday type and family size — what to pack at home, what to buy abroad" },
        { icon: Wallet, t: "Expense Tracking", d: "Smart split between participants, minimized money transfers, full history" },
        { icon: Users, t: "Group Chat", d: "The whole family in one place — updates, photos, on-the-ground coordination" },
        { icon: MessageCircle, t: "WhatsApp Sharing", d: "Send the full itinerary to the family group in one click" },
      ],
    },
    religious: {
      title: "Built for observant families — top to bottom",
      items: [
        { icon: Flame, t: "Shabbat & Holidays", d: "System auto-detects and blocks vehicle / shopping / paid-activity suggestions on sacred days" },
        { icon: Star, t: "Chabad Houses", d: "Location, phone, service times, hosting & meal options — for every destination in our directory" },
        { icon: Utensils, t: "Kashrut", d: "Kosher restaurants, kosher product stores, and kitchen kashering for rented apartments" },
        { icon: Heart, t: "Halachic Times", d: "Prayer, sunset, Shabbat-end times — calculated for your specific destination" },
      ],
    },
    how: {
      title: "How it works",
      steps: [
        { n: 1, t: "Share your details", d: "Destination, dates, family composition — a short 1-minute form" },
        { n: 2, t: "We reach out", d: "Our team contacts you within 24 hours for a discovery call — what matters, budget, the family dynamic" },
        { n: 3, t: "Plan together", d: "We build the trip together. You pick from curated suggestions, we handle every detail" },
        { n: 4, t: "Travel stress-free", d: "App in hand, all info always accessible, and our team is on call if you need help on the ground" },
      ],
    },
    form: {
      title: "Leave your details — we'll reach out within 24 hours",
      sub: "No commitment, no cost — a discovery call to understand your family's needs",
      name: "Full name",
      email: "Email",
      phone: "Phone (WhatsApp preferred)",
      destination: "Trip destination",
      destinationPh: "Rome / Athens / Montenegro / other",
      startDate: "Departure date",
      endDate: "Return date",
      adults: "Adults",
      children: "Children",
      message: "Anything we should know upfront?",
      messagePh: "Allergies, preferences, special circumstances...",
      submit: "Send",
      sending: "Sending...",
      success: "Thank you! We received your details and will reach out within 24 hours.",
      error: "Submission failed — try again or email directly to eli@biglog.co.il",
      required: "Required",
    },
    footer: {
      built: "TripMaster · Boutique family trip planning",
      contact: "Contact: eli@biglog.co.il",
    },
  },
};

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>("he");
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  const fromLogin = searchParams.get("from") === "login";
  const t = COPY[locale];

  // Auto-scroll to the form if a user was bounced here from /login
  useEffect(() => {
    if (fromLogin) {
      const el = document.getElementById("lead-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [fromLogin]);

  return (
    <div dir={t.dir} className="min-h-screen bg-[color:var(--background)]">
      {/* Nav */}
      <nav className="absolute top-0 start-0 end-0 z-20 px-4 md:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl text-[color:var(--gold-100)]">
          TripMaster
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocale(locale === "he" ? "en" : "he")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[color:var(--gold-500)]/20 text-[color:var(--gold-100)] text-xs hover:bg-[color:var(--gold-500)]/10 transition"
          >
            <Globe size={12} /> {t.nav.language}
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[color:var(--gold-600)]/20 text-[color:var(--gold-100)] text-xs hover:bg-[color:var(--gold-600)]/30 transition"
          >
            {t.nav.login}
          </Link>
        </div>
      </nav>

      {/* Hero with layered imagery */}
      <section className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-8 overflow-hidden min-h-[90vh] md:min-h-[85vh] flex items-center">
        {/* Primary hero image — Santorini at golden hour */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=2000&q=80&auto=format')",
          }}
        />
        {/* Gradients for legibility + drama */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-[color:var(--background)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--background)]/40 via-transparent to-[color:var(--background)]/40" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block text-[11px] md:text-xs uppercase tracking-[0.35em] text-[color:var(--gold-300)] mb-5 drop-shadow-lg">
              {t.hero.tagline}
            </span>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] text-white mb-6 drop-shadow-2xl">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-lg text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-md">
              {t.hero.sub}
            </p>
            <a
              href="#lead-form"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-l from-[color:var(--gold-700)] to-[color:var(--gold-500)] text-white font-medium shadow-2xl hover:shadow-[0_20px_60px_-20px_rgba(212,169,96,0.6)] hover:scale-[1.03] transition-all"
            >
              <Sparkles size={18} />
              {t.hero.cta2}
              <ArrowRight size={16} className={locale === "he" ? "rotate-180" : ""} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Destinations we know — premium image strip */}
      <section className="py-12 md:py-16 px-4 md:px-8 bg-[color:var(--background)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold-300)]">
              {locale === "he" ? "יעדים שאנחנו מכירים מקרוב" : "Destinations we know intimately"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            {DESTINATIONS.map((d, i) => (
              <motion.div
                key={d.name.he}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden group cursor-default"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                  style={{ backgroundImage: `url('${d.img}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-3 text-white">
                  <div className="font-serif text-sm md:text-base">{d.name[locale]}</div>
                  <div className="text-[10px] text-white/70">{d.country[locale]}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-center text-[color:var(--gold-100)] mb-12">
            {t.features.title}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.features.items.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.t}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-5 bg-[color:var(--card)] border border-[color:var(--gold-500)]/15 hover:border-[color:var(--gold-500)]/40 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--gold-500)]/15 grid place-items-center mb-3">
                    <Icon size={18} className="text-[color:var(--gold-300)]" />
                  </div>
                  <h3 className="font-serif text-lg text-[color:var(--gold-100)] mb-1">{f.t}</h3>
                  <p className="text-xs text-foreground/70 leading-relaxed">{f.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Religious families */}
      <section className="py-16 md:py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-[color:var(--gold-900)]/15 to-transparent">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-center text-[color:var(--gold-100)] mb-12">
            {t.religious.title}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {t.religious.items.map((r, i) => {
              const Icon = r.icon;
              return (
                <motion.div
                  key={r.t}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl p-6 bg-[color:var(--card)] border border-[color:var(--gold-500)]/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[color:var(--gold-500)] to-[color:var(--gold-700)] grid place-items-center flex-shrink-0">
                      <Icon size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg text-[color:var(--gold-100)] mb-1">{r.t}</h3>
                      <p className="text-sm text-foreground/75 leading-relaxed">{r.d}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-center text-[color:var(--gold-100)] mb-12">
            {t.how.title}
          </h2>
          <ol className="space-y-4">
            {t.how.steps.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, x: locale === "he" ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-4 rounded-2xl p-5 bg-[color:var(--card)] border border-[color:var(--gold-500)]/15"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[color:var(--gold-500)] to-[color:var(--gold-700)] grid place-items-center flex-shrink-0 font-serif text-white text-lg">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-serif text-lg text-[color:var(--gold-100)] mb-1">{s.t}</h3>
                  <p className="text-sm text-foreground/70">{s.d}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Lead form */}
      <LeadForm locale={locale} copy={t.form} prefillEmail={prefillEmail} fromLogin={fromLogin} />

      {/* Floating WhatsApp — always visible on the landing page */}
      <a
        href={`https://wa.me/972524848358?text=${encodeURIComponent(
          locale === "he"
            ? "שלום אלי, ראיתי את TripMaster ורציתי לשמוע עוד"
            : "Hi Eli, I saw TripMaster and wanted to learn more"
        )}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="fixed bottom-5 start-5 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-2xl hover:scale-105 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.94 11.94 0 0012.03 0C5.45 0 .08 5.37.08 11.96c0 2.11.55 4.17 1.6 5.98L0 24l6.23-1.63a11.95 11.95 0 005.8 1.48h.01c6.58 0 11.95-5.37 11.95-11.96 0-3.19-1.24-6.19-3.47-8.41zM12.04 21.8h-.01a9.82 9.82 0 01-5-1.37l-.36-.21-3.69.97.99-3.6-.23-.37a9.83 9.83 0 01-1.51-5.26c0-5.44 4.43-9.87 9.88-9.87 2.64 0 5.12 1.03 6.98 2.9a9.79 9.79 0 012.89 6.98c0 5.45-4.43 9.83-9.94 9.83zm5.4-7.36c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.5l-.56-.01c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
        </svg>
        <span className="hidden md:inline text-sm font-medium">
          {locale === "he" ? "דברו איתנו" : "Chat with us"}
        </span>
      </a>

      {/* Footer */}
      <footer className="py-8 px-4 md:px-8 border-t border-[color:var(--gold-500)]/15 text-center text-xs text-foreground/50">
        <div className="mb-1">{t.footer.built}</div>
        <div>
          <a href="mailto:eli@biglog.co.il" className="hover:text-[color:var(--gold-200)]">
            {t.footer.contact}
          </a>
        </div>
      </footer>
    </div>
  );
}

function LeadForm({
  locale,
  copy,
  prefillEmail,
  fromLogin,
}: {
  locale: Locale;
  copy: (typeof COPY)["he"]["form"];
  prefillEmail?: string;
  fromLogin?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/leads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          destination,
          travel_dates:
            startDate && endDate
              ? `${startDate} → ${endDate}`
              : startDate || endDate || "",
          adults,
          children,
          message,
          locale,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "submit failed");
      }
      setOk(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : copy.error);
    } finally {
      setSending(false);
    }
  }

  if (ok) {
    return (
      <section id="lead-form" className="py-16 md:py-24 px-4 md:px-8">
        <div className="max-w-xl mx-auto rounded-3xl p-10 bg-[color:var(--card)] border border-[color:var(--gold-500)]/30 text-center">
          <CheckCircle2 className="mx-auto text-[color:var(--olive-500)] mb-4" size={48} />
          <p className="font-serif text-xl text-[color:var(--gold-100)] leading-relaxed">
            {copy.success}
          </p>
        </div>
      </section>
    );
  }

  const labelCls = "block text-xs text-foreground/70 mb-1";
  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--gold-500)]/50 transition";

  return (
    <section id="lead-form" className="py-16 md:py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-[color:var(--gold-900)]/20 to-transparent">
      <div className="max-w-2xl mx-auto">
        {fromLogin && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-[color:var(--gold-500)]/40 bg-[color:var(--gold-500)]/10 p-4 md:p-5 flex items-start gap-3"
          >
            <Sparkles className="text-[color:var(--gold-300)] flex-shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-serif text-lg text-[color:var(--gold-100)] mb-1">
                {locale === "he"
                  ? "לא מצאנו את המייל שלך במערכת — בוא נכיר!"
                  : "We didn't find your email — let's get to know you!"}
              </div>
              <p className="text-xs md:text-sm text-foreground/70 leading-relaxed">
                {locale === "he"
                  ? "נראה שעדיין אין לכם חשבון או הזמנה פעילה. השאירו פרטים קצרים והצוות שלנו יחזור אליכם תוך 24 שעות לשיחת היכרות — נבין מה חשוב לכם ונתחיל לתכנן יחד."
                  : "It looks like you don't have an account or active invitation yet. Leave a few details and our team will reach out within 24 hours for a discovery call — we'll understand what matters and start planning together."}
              </p>
            </div>
          </motion.div>
        )}
        <div className="text-center mb-8">
          <h2 className="font-serif text-3xl md:text-4xl text-[color:var(--gold-100)] mb-2">
            {copy.title}
          </h2>
          <p className="text-sm text-foreground/70">{copy.sub}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-6 md:p-8 bg-[color:var(--card)] border border-[color:var(--gold-500)]/20 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {copy.name} <span className="text-red-400">*</span>
              </label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                {copy.email} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{copy.phone}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                dir="ltr"
                placeholder="+972-50-..."
              />
            </div>
            <div>
              <label className={labelCls}>
                {copy.destination} <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={inputCls}
                placeholder={copy.destinationPh}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{copy.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelCls}>{copy.endDate}</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{copy.adults}</label>
              <input
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelCls}>{copy.children}</label>
              <input
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{copy.message}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className={inputCls + " resize-none"}
              placeholder={copy.messagePh}
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-l from-[color:var(--gold-700)] to-[color:var(--gold-500)] text-white font-medium shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin" size={16} /> {copy.sending}
              </>
            ) : (
              <>
                <Sparkles size={16} /> {copy.submit}
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-4 text-[11px] text-foreground/50 pt-2">
            <a href="mailto:eli@biglog.co.il" className="inline-flex items-center gap-1 hover:text-[color:var(--gold-200)]">
              <Mail size={11} /> eli@biglog.co.il
            </a>
            <a
              href={`https://wa.me/972524848358?text=${encodeURIComponent(
                locale === "he"
                  ? "שלום אלי, ראיתי את TripMaster ורציתי לשמוע עוד"
                  : "Hi Eli, I saw TripMaster and wanted to learn more"
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-[color:var(--gold-200)]"
            >
              <Phone size={11} /> WhatsApp
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}
