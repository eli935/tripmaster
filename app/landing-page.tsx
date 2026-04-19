"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Calendar, Map, Utensils, ShoppingBag, Users, Wallet, MessageCircle,
  ArrowRight, Loader2, CheckCircle2, Globe, Star, Phone, Mail, Flame, Heart,
} from "lucide-react";

type Locale = "he" | "en";

const COPY = {
  he: {
    dir: "rtl" as const,
    nav: { login: "כניסה", language: "English" },
    hero: {
      tagline: "תכנון טיולים חכם למשפחות ישראליות",
      title: "הטיול הבא שלכם — מתוכנן, מאורגן, בעברית",
      sub: "אפליקציה חכמה שמאחדת תכנון ארוחות, רשימות ציוד, מיקומי בית חב״ד, מסעדות כשרות, זמני שבת, תקציב משפחתי וסדר יום מלא — הכל במקום אחד.",
      cta: "התחל עכשיו",
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
        { n: 1, t: "השאירו פרטים", d: "יעד, תאריכים משוערים, הרכב המשפחה" },
        { n: 2, t: "נחזור אליכם", d: "אני (אלי) יוצר איתכם קשר אישי תוך 24 שעות כדי להבין מה הכי חשוב לכם" },
        { n: 3, t: "תכנון בשיתוף", d: "אנחנו בונים ביחד את הטיול — אתם בוחרים מתוך הצעות, אני דואג לפרטים" },
        { n: 4, t: "טיול בראש שקט", d: "אפליקציה ביד, כל המידע זמין תמיד, ואני זמין אם צריך עזרה בשטח" },
      ],
    },
    form: {
      title: "השאירו פרטים ונחזור אליכם תוך 24 שעות",
      sub: "ללא התחייבות, ללא עלות — שיחת היכרות להבנת הצרכים שלכם",
      name: "שם מלא",
      email: "אימייל",
      phone: "טלפון (עדיף וואטסאפ)",
      destination: "יעד הטיול",
      destinationPh: "רומא / אתונה / מונטנגרו / אחר",
      travelDates: "תאריכים משוערים",
      travelDatesPh: "פסח 2026 / ספטמבר / בין הזמנים",
      adults: "מבוגרים",
      children: "ילדים",
      message: "משהו שכדאי שנדע מראש?",
      messagePh: "אלרגיות, העדפות, נסיבות מיוחדות...",
      submit: "שלח פרטים",
      sending: "שולח...",
      success: "תודה! קיבלתי את הפרטים שלך ואחזור אליך תוך 24 שעות.",
      error: "שגיאה בשליחה — אפשר לנסות שוב או לשלוח ישירות ל-eli@biglog.co.il",
      required: "שדה חובה",
    },
    footer: {
      built: "נבנה על ידי אלי רוזנפלד · BigLog",
      contact: "יצירת קשר: eli@biglog.co.il",
    },
  },
  en: {
    dir: "ltr" as const,
    nav: { login: "Log in", language: "עברית" },
    hero: {
      tagline: "Smart trip planning for Israeli families",
      title: "Your next trip — planned, organized, stress-free",
      sub: "A smart app that unifies meal planning, packing lists, Chabad house locations, kosher restaurants, Shabbat times, family budgeting, and a full daily itinerary — all in one place.",
      cta: "Get started",
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
        { n: 1, t: "Share your details", d: "Destination, approximate dates, family composition" },
        { n: 2, t: "We reach out", d: "I (Eli) personally contact you within 24 hours to understand what matters most" },
        { n: 3, t: "Plan together", d: "We build the trip together — you choose from suggestions, I handle the details" },
        { n: 4, t: "Travel stress-free", d: "App in hand, all info always available, and I'm on call if you need help on the ground" },
      ],
    },
    form: {
      title: "Leave your details — we'll reach out within 24 hours",
      sub: "No commitment, no cost — a discovery call to understand your needs",
      name: "Full name",
      email: "Email",
      phone: "Phone (WhatsApp preferred)",
      destination: "Trip destination",
      destinationPh: "Rome / Athens / Montenegro / other",
      travelDates: "Approximate dates",
      travelDatesPh: "Passover 2026 / September / summer break",
      adults: "Adults",
      children: "Children",
      message: "Anything we should know upfront?",
      messagePh: "Allergies, preferences, special circumstances...",
      submit: "Send",
      sending: "Sending...",
      success: "Thanks! I got your details and will reach out within 24 hours.",
      error: "Submission failed — try again or email directly to eli@biglog.co.il",
      required: "Required",
    },
    footer: {
      built: "Built by Eli Rosenfeld · BigLog",
      contact: "Contact: eli@biglog.co.il",
    },
  },
};

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>("he");
  const t = COPY[locale];

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

      {/* Hero */}
      <section className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-8 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1600&q=75&auto=format')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--background)]/40 via-[color:var(--background)]/80 to-[color:var(--background)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block text-[11px] uppercase tracking-[0.3em] text-[color:var(--gold-300)] mb-4">
              {t.hero.tagline}
            </span>
            <h1 className="font-serif text-4xl md:text-6xl leading-[1.1] text-[color:var(--gold-100)] mb-6">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-lg text-foreground/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t.hero.sub}
            </p>
            <a
              href="#lead-form"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-l from-[color:var(--gold-700)] to-[color:var(--gold-500)] text-white font-medium shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
            >
              <Sparkles size={18} />
              {t.hero.cta2}
              <ArrowRight size={16} className={locale === "he" ? "rotate-180" : ""} />
            </a>
          </motion.div>
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
      <LeadForm locale={locale} copy={t.form} />

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

function LeadForm({ locale, copy }: { locale: Locale; copy: (typeof COPY)["he"]["form"] }) {
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDates, setTravelDates] = useState("");
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
          travel_dates: travelDates,
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

          <div>
            <label className={labelCls}>{copy.travelDates}</label>
            <input
              value={travelDates}
              onChange={(e) => setTravelDates(e.target.value)}
              className={inputCls}
              placeholder={copy.travelDatesPh}
            />
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
