/**
 * Destination data — Chabad houses, kosher restaurants, attractions
 * Will grow over time; initial seed for Montenegro
 */

export interface ChabadHouse {
  name: string;
  rabbi: string;
  address: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  google_maps: string;
  waze?: string;
  services: string[]; // tefillot, meals, takeout, mikveh
  notes?: string;
}

export interface KosherRestaurant {
  name: string;
  type: "meat" | "dairy" | "parve" | "kosher";
  certification: string;
  address: string;
  phone?: string;
  whatsapp?: string;
  google_maps: string;
  waze?: string;
  hours?: string;
  website?: string;
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  specialties?: string[];
  notes?: string;
}

export interface Attraction {
  name: string;
  type: "nature" | "historic" | "beach" | "museum" | "activity" | "viewpoint" | "religious" | "kids";
  description: string;
  address: string;
  google_maps: string;
  waze?: string;
  website?: string;
  price?: string;
  duration?: string;
  hours?: string;
  image?: string;
  must_visit?: boolean;
  kids_friendly?: boolean;
  religious_compatible?: boolean; // can visit on Shabbat/Chag walking
}

export interface DestinationInfo {
  name: string;
  country: string;
  country_code: string;
  currency: string; // ISO code for exchange rate
  currency_symbol: string;
  hero_image: string;
  gallery: string[];
  description: string;
  language: string;
  timezone: string;
  emergency_phone: string;
  chabad: ChabadHouse[];
  restaurants: KosherRestaurant[];
  attractions: Attraction[];
  shopping_centers: { name: string; address: string; google_maps: string; notes?: string }[];
  airport: { name: string; code: string; address: string; google_maps: string };
  weather_note?: string;
  halachic_notes?: string[];
  coordinates?: {
    lat: number;
    lng: number;
    tz: string;       // IANA timezone, e.g. "Europe/Rome"
    geonameid?: number;
  };
}

// ========= MONTENEGRO =========
export const MONTENEGRO: DestinationInfo = {
  name: "מונטנגרו",
  country: "Montenegro",
  country_code: "ME",
  currency: "EUR",
  currency_symbol: "€",
  hero_image: "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=600&q=75",
  gallery: [
    "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=600&q=75", // Kotor bay
    "https://images.unsplash.com/photo-1626108870272-4317d1772c4c?w=600&q=75", // Budva old town
    "https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?w=600&q=75", // Sveti Stefan
    "https://images.unsplash.com/photo-1632170568962-2e7c0c32bcd8?w=600&q=75", // mountains
    "https://images.unsplash.com/photo-1630067232620-ba6b3f5b7abd?w=600&q=75", // beaches
  ],
  description:
    "מונטנגרו, פנינת הבלקן על חופי הים האדריאטי, מציעה שילוב נדיר של הרים דרמטיים, חופים כחולים, עיירות עתיקות ונופים עוצרי נשימה. יעד מושלם למשפחות חרדיות עם בית חב״ד פעיל ומסעדה כשרה למהדרין.",
  language: "סרבית/מונטנגרית",
  timezone: "Europe/Podgorica (UTC+1, קיץ UTC+2)",
  emergency_phone: "112",
  chabad: [
    {
      name: "בית חב״ד מונטנגרו",
      rabbi: "הרב אריה אדלקופף",
      address: "Dukley Hotel & Resort, Zavala Peninsula, Budva",
      phone: "+382-69-170-001",
      whatsapp: "+382-69-170-001",
      email: "rabbi@chabadmontenegro.com",
      website: "https://chabad-montenegro.com",
      google_maps: "https://maps.google.com/?q=Dukley+Hotel+Budva+Montenegro",
      waze: "https://waze.com/ul?q=Dukley+Hotel+Budva",
      services: ["תפילות", "סעודות שבת וחג", "הזמנת מזון כשר", "קהילה יהודית"],
      notes: "מרכז החיים היהודיים במונטנגרו. הרב ארי זמין בוואטסאפ לכל שאלה.",
    },
    {
      name: "בית כנסת קהילת פודגוריצה",
      rabbi: "הקהילה היהודית של מונטנגרו",
      address: "Podgorica, Montenegro",
      phone: "+382-69-400-001",
      google_maps: "https://maps.google.com/?q=Jewish+Community+Podgorica",
      services: ["תפילות בחגים"],
      notes: "קהילה קטנה בבירה, בעיקר לחגים.",
    },
  ],
  restaurants: [
    {
      name: "מסעדת שלום (Shalom)",
      type: "meat",
      certification: "חב״ד מונטנגרו — כשר למהדרין",
      address: "Hotel Harmonia by Dukley, Zavala Peninsula, Budva",
      phone: "+382-69-170-001",
      whatsapp: "+382-69-170-001",
      google_maps: "https://maps.google.com/?q=Shalom+Kosher+Restaurant+Budva",
      waze: "https://waze.com/ul?q=Shalom+Restaurant+Budva",
      hours: "יום-ה: 12:00-22:00 | ו׳: 12:00-15:00 | ש׳: סגור",
      website: "https://harmoniahotel.com/en/shalom-2",
      price_range: "$$$",
      specialties: ["בשרים צלויים", "דגים", "סלטים ישראלים", "מנות חגיגיות"],
      notes: "המסעדה הכשרה היחידה במונטנגרו. חובה להזמין מראש בתקופת החגים.",
    },
  ],
  attractions: [
    {
      name: "העיר העתיקה של קוטור (Stari Grad Kotor)",
      type: "historic",
      description:
        "עיר עתיקה מוקפת חומות UNESCO עם סמטאות מעוגלות, כנסיות ומגדלים. טיפוס ל\"חומות העיר\" מציע תצפית מרהיבה על המפרץ.",
      address: "Stari Grad, Kotor, Montenegro",
      google_maps: "https://maps.google.com/?q=Stari+Grad+Kotor",
      waze: "https://waze.com/ul?q=Kotor+Old+Town",
      price: "חינם (טיפוס לחומות: 15€)",
      duration: "2-4 שעות",
      image: "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
      religious_compatible: true,
    },
    {
      name: "מערת ליפה (Lipa Cave)",
      type: "nature",
      description:
        "מערת נטיפים ענקית עם רכבת קטנה שלוקחת את המבקרים לכניסה. חוויה מושלמת לילדים.",
      address: "Lipa Dobrska, near Cetinje",
      google_maps: "https://maps.google.com/?q=Lipa+Cave+Montenegro",
      waze: "https://waze.com/ul?q=Lipa+Cave",
      website: "https://lipa-cave.me",
      price: "מבוגר 13€, ילד 8€",
      duration: "1.5 שעות",
      hours: "אפריל-אוקטובר: 10:00-17:00 | חובה הזמנה מראש",
      image: "https://images.unsplash.com/photo-1583445095369-4dbe574f58a5?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
    },
    {
      name: "אגם סקאדר (Skadar Lake)",
      type: "nature",
      description:
        "האגם הגדול ביותר בבלקן, גן לאומי עם שייטים על סירות עץ, ציפורים נדירות, ותצפיות מטורפות מ-Pavlova Strana.",
      address: "Virpazar, Montenegro",
      google_maps: "https://maps.google.com/?q=Skadar+Lake+Virpazar",
      waze: "https://waze.com/ul?q=Virpazar+Skadar",
      price: "שייט: 25€ למבוגר",
      duration: "חצי יום",
      image: "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
      religious_compatible: false,
    },
    {
      name: "חוות החמורים (Donkey Farm Martinici)",
      type: "kids",
      description:
        "חווה ייחודית שפתוחה רק בימי ראשון בבוקר. כרטיס הכניסה: קילו גזר או תפוחים להאכלת החמורים. חוויה בלתי נשכחת לילדים.",
      address: "Martinici, near Danilovgrad",
      google_maps: "https://maps.google.com/?q=Donkey+Farm+Martinici",
      price: "קילו גזר/תפוחים",
      duration: "1-2 שעות",
      hours: "רק בימי ראשון: 10:00-13:00",
      must_visit: false,
      kids_friendly: true,
    },
    {
      name: "מפלי ניאגרה מונטנגרו (Niagara Falls)",
      type: "nature",
      description:
        "מפלים יפהפיים שפעילים בעיקר באביב. מקום מעולה לפיקניק על הסלעים ליד המים.",
      address: "Niagara Falls, near Podgorica",
      google_maps: "https://maps.google.com/?q=Niagara+Falls+Montenegro",
      price: "חינם",
      duration: "1-2 שעות",
      must_visit: false,
      kids_friendly: true,
    },
    {
      name: "רכבל קוטור (Kotor Cable Car)",
      type: "viewpoint",
      description:
        "רכבל חדש שעולה מהעמק לפסגת הר לובצ'ן ב-11 דקות. הנוף עוצר נשימה.",
      address: "Dub Station, Kotor",
      google_maps: "https://maps.google.com/?q=Kotor+Cable+Car",
      website: "https://kotorcablecar.com",
      price: "מבוגר 23€, ילד 13€",
      duration: "2-3 שעות",
      hours: "9:00-18:00 (תלוי מזג אוויר)",
      image: "https://images.unsplash.com/photo-1632170568962-2e7c0c32bcd8?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
    },
    {
      name: "פרסט ואי גבירתנו של הסלעים",
      type: "historic",
      description:
        "עיירת חוף קסומה. שייט בסירה לאי מלאכותי עם כנסייה היסטורית. חוויה יפהפייה.",
      address: "Perast, Bay of Kotor",
      google_maps: "https://maps.google.com/?q=Perast+Our+Lady+of+the+Rocks",
      price: "5€ שייט, 2€ כניסה לכנסייה",
      duration: "2 שעות",
      image: "https://images.unsplash.com/photo-1564668292-c0d5b866fc33?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
    },
    {
      name: "סבטי סטפן (Sveti Stefan)",
      type: "viewpoint",
      description:
        "אי-עיירה היסטורית מחוברת ליבשה בגשר חול. אייקון תיירותי של מונטנגרו. תצפית בלבד (האי פרטי).",
      address: "Sveti Stefan, near Budva",
      google_maps: "https://maps.google.com/?q=Sveti+Stefan",
      price: "חינם מהתצפית",
      duration: "1 שעה",
      image: "https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?w=600&q=75",
      must_visit: true,
      religious_compatible: true,
    },
    {
      name: "מוזיאון הצוללות (Naval Heritage Collection)",
      type: "museum",
      description:
        "צוללת אמיתית שעומדת על היבשה שאפשר להיכנס אליה. חוויה אותנטית שילדים מתים עליה.",
      address: "Tivat, Porto Montenegro",
      google_maps: "https://maps.google.com/?q=Naval+Heritage+Tivat",
      price: "מבוגר 10€, ילד 5€",
      duration: "1 שעה",
      must_visit: false,
      kids_friendly: true,
    },
    {
      name: "חוף מוגרן (Mogren Beach)",
      type: "beach",
      description:
        "חוף חבוי שחוצים אליו דרך שביל חצוב בצוק. מים צלולים. מתאים למנהג קריעת ים סוף בשביעי של פסח.",
      address: "Mogren, Budva",
      google_maps: "https://maps.google.com/?q=Mogren+Beach+Budva",
      price: "חינם",
      duration: "2-3 שעות",
      image: "https://images.unsplash.com/photo-1630067232620-ba6b3f5b7abd?w=600&q=75",
      must_visit: false,
      religious_compatible: true,
    },
  ],
  shopping_centers: [
    {
      name: "HDL Laković (Hard Diskont)",
      address: "Budva entrance",
      google_maps: "https://maps.google.com/?q=HDL+Lakovic+Budva",
      notes: "הגדול והזול ביותר. פתוח עד 21:30. סגור ביום ראשון!",
    },
    {
      name: "Voli Supermarket",
      address: "Budva center",
      google_maps: "https://maps.google.com/?q=Voli+Budva",
      notes: "רשת סופר מקומית עם סניפים רבים.",
    },
  ],
  airport: {
    name: "Tivat Airport",
    code: "TIV",
    address: "Tivat, Montenegro",
    google_maps: "https://maps.google.com/?q=Tivat+Airport",
  },
  weather_note: "אפריל: יום 15-19°C, לילה 8-10°C. סיכוי גבוה לגשם.",
  halachic_notes: [
    "אין עירוב עירוני בבודווה — אין לטלטל בשבת/חג",
    "זמני שבת ל-Budva: Chabad.org/candle-lighting",
    "בשרי טרי: מביאים מהארץ (קפוא)",
    "חלב ישראל: רק דרך בית חב״ד בהזמנה מראש",
  ],
  coordinates: { lat: 42.2864, lng: 18.8400, tz: "Europe/Podgorica", geonameid: 3204541 },
};

// ========= ITALY — ROME =========
export const ROME: DestinationInfo = {
  name: "רומא, איטליה",
  country: "Italy",
  country_code: "IT",
  currency: "EUR",
  currency_symbol: "€",
  hero_image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75",
  gallery: [
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75",
    "https://images.unsplash.com/photo-1529260830199-42c24126f198?w=600&q=75",
    "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=600&q=75",
  ],
  description:
    "רומא, בירת איטליה, שוקקת היסטוריה בת אלפי שנים. הגטו היהודי ההיסטורי בעיר הוא אחד העתיקים בעולם, עם בתי כנסת, מסעדות כשרות ואטרקציות לאורך הדרך.",
  language: "איטלקית",
  timezone: "Europe/Rome (UTC+1, קיץ UTC+2)",
  emergency_phone: "112",
  chabad: [
    {
      name: "חב״ד רומא",
      rabbi: "הרב יצחק חזן",
      address: "Via Balbo 39, Roma",
      phone: "+39-06-4883054",
      whatsapp: "+39-335-8272929",
      email: "info@chabadroma.it",
      website: "https://www.chabadroma.it",
      google_maps: "https://maps.google.com/?q=Chabad+Rome+Via+Balbo",
      services: ["תפילות", "סעודות חג", "הזמנת מזון", "מקווה"],
      notes: "קהילה גדולה, במרכז הגטו היהודי.",
    },
  ],
  restaurants: [
    {
      name: "Su Ghetto — Kosher Restaurant",
      type: "meat",
      certification: "רבנות רומא — כשר למהדרין",
      address: "Via del Portico d'Ottavia 2a, Rome",
      phone: "+39-06-6892481",
      google_maps: "https://maps.google.com/?q=Su+Ghetto+Rome",
      hours: "יום-חמישי + ראשון: 12:00-22:00",
      price_range: "$$$",
      specialties: ["אנטיפסטי רומאיים", "ארטישוק", "בשרים איטלקיים"],
    },
    {
      name: "Nonna Betta",
      type: "meat",
      certification: "רבנות רומא",
      address: "Via del Portico d'Ottavia 16, Rome",
      phone: "+39-06-6806263",
      google_maps: "https://maps.google.com/?q=Nonna+Betta+Rome",
      price_range: "$$",
      specialties: ["מטבח רומאי-יהודי מסורתי"],
    },
  ],
  attractions: [
    {
      name: "הקולוסיאום",
      type: "historic",
      description: "האמפיתיאטרון הגדול ביותר אי פעם שנבנה, סמל של רומא העתיקה.",
      address: "Piazza del Colosseo, Rome",
      google_maps: "https://maps.google.com/?q=Colosseum+Rome",
      price: "16€ למבוגר",
      duration: "2-3 שעות",
      image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
    },
    {
      name: "הוותיקן וכיפת פטרוס",
      type: "historic",
      description: "מרכז הכנסייה הקתולית עם כיפת מיכלאנג'לו הידועה.",
      address: "Vatican City",
      google_maps: "https://maps.google.com/?q=Vatican+City",
      duration: "חצי יום",
      image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=600&q=75",
      must_visit: true,
    },
    {
      name: "מזרקת טרווי",
      type: "historic",
      description: "המזרקה הברוקית המפורסמת בעולם. מסורת: לזרוק מטבע כדי לחזור לרומא.",
      address: "Piazza di Trevi, Rome",
      google_maps: "https://maps.google.com/?q=Trevi+Fountain",
      price: "חינם",
      duration: "30 דקות",
      must_visit: true,
      kids_friendly: true,
    },
    {
      name: "הגטו היהודי",
      type: "religious",
      description: "הגטו היהודי העתיק בעולם, עם בית הכנסת הגדול של רומא.",
      address: "Rione XI Sant'Angelo, Rome",
      google_maps: "https://maps.google.com/?q=Jewish+Ghetto+Rome",
      must_visit: true,
      religious_compatible: true,
    },
  ],
  shopping_centers: [
    {
      name: "Kosher Market Rome",
      address: "Via Santa Maria del Pianto, Rome",
      google_maps: "https://maps.google.com/?q=Kosher+Market+Rome",
      notes: "מרכול כשר במרכז הגטו היהודי.",
    },
  ],
  airport: {
    name: "Leonardo da Vinci (Fiumicino)",
    code: "FCO",
    address: "Fiumicino, Rome",
    google_maps: "https://maps.google.com/?q=Fiumicino+Airport",
  },
  coordinates: { lat: 41.9028, lng: 12.4964, tz: "Europe/Rome", geonameid: 3169070 },
};

// ========= GREECE — ATHENS =========
export const ATHENS: DestinationInfo = {
  name: "אתונה, יוון",
  country: "Greece",
  country_code: "GR",
  currency: "EUR",
  currency_symbol: "€",
  hero_image: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=600&q=75",
  gallery: [
    "https://images.unsplash.com/photo-1555993539-1732b0258235?w=600&q=75",
    "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=600&q=75",
  ],
  description: "אתונה, ערש הדמוקרטיה, משלבת היסטוריה עתיקה עם חיים מודרניים.",
  language: "יוונית",
  timezone: "Europe/Athens (UTC+2, קיץ UTC+3)",
  emergency_phone: "112",
  chabad: [
    {
      name: "חב״ד אתונה",
      rabbi: "הרב מנדל הנדל",
      address: "Aiolou 57, Athens",
      phone: "+30-210-5220535",
      whatsapp: "+30-695-1600000",
      website: "https://www.chabadathens.com",
      google_maps: "https://maps.google.com/?q=Chabad+Athens",
      services: ["תפילות", "סעודות חג", "הזמנת מזון כשר"],
    },
  ],
  restaurants: [
    {
      name: "Gostijo Kosher Restaurant",
      type: "meat",
      certification: "רבנות יוון",
      address: "Athinas 17, Athens",
      google_maps: "https://maps.google.com/?q=Gostijo+Athens",
      price_range: "$$",
    },
  ],
  attractions: [
    {
      name: "האקרופוליס",
      type: "historic",
      description: "הסמל של אתונה העתיקה, מקדש הפרתנון על הגבעה.",
      address: "Acropolis, Athens",
      google_maps: "https://maps.google.com/?q=Acropolis+Athens",
      price: "20€",
      duration: "3 שעות",
      image: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=600&q=75",
      must_visit: true,
      kids_friendly: true,
    },
  ],
  shopping_centers: [],
  airport: {
    name: "Athens International",
    code: "ATH",
    address: "Athens, Greece",
    google_maps: "https://maps.google.com/?q=Athens+Airport",
  },
  coordinates: { lat: 37.9838, lng: 23.7275, tz: "Europe/Athens", geonameid: 264371 },
};

export const DESTINATIONS_DB: Record<string, DestinationInfo> = {
  ME: MONTENEGRO,
  Montenegro: MONTENEGRO,
  מונטנגרו: MONTENEGRO,
  IT: ROME,
  Rome: ROME,
  רומא: ROME,
  Italy: ROME,
  GR: ATHENS,
  Athens: ATHENS,
  אתונה: ATHENS,
  Greece: ATHENS,
};

/**
 * Find destination by trip destination string
 */
export function findDestination(destination: string, countryCode?: string): DestinationInfo | null {
  if (countryCode && DESTINATIONS_DB[countryCode]) return DESTINATIONS_DB[countryCode];

  const normalized = destination.trim();
  // Try exact match
  if (DESTINATIONS_DB[normalized]) return DESTINATIONS_DB[normalized];

  // Try substring match
  for (const key of Object.keys(DESTINATIONS_DB)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return DESTINATIONS_DB[key];
    }
  }

  return null;
}
