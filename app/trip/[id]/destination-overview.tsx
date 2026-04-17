"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MapPin,
  Phone,
  MessageCircle,
  Globe,
  Navigation,
  Clock,
  Star,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  ShoppingBag,
  Plane,
  Mountain,
  Ticket,
  Gift,
  Baby,
  Building2,
  Car,
  CalendarPlus,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { DestinationInfo, Attraction } from "@/lib/destinations";
import type { Trip, TripDay } from "@/lib/supabase/types";
import { fetchWeather, type WeatherDay } from "@/lib/weather";

type AttractionFilter = "all" | "hiking" | "paid" | "free" | "kid_friendly";

const FILTER_LABELS: Record<AttractionFilter, string> = {
  all: "הכל",
  hiking: "🥾 הליכות",
  paid: "🎟️ בתשלום",
  free: "🎁 חינם",
  kid_friendly: "👶 לילדים",
};

interface DestinationOverviewProps {
  destination: DestinationInfo;
  rates: Record<string, number> | null;
  trip?: Trip;
  days?: TripDay[];
}

export function DestinationOverview({
  destination,
  rates,
  trip,
  days = [],
}: DestinationOverviewProps) {
  const [filter, setFilter] = useState<AttractionFilter>("all");
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const isDomestic = trip?.location_type === "domestic";
  const destinationQuery = encodeURIComponent(trip?.destination || destination.country);

  // Load weather (client-side). If trip dates + coordinates present, fetch from Open-Meteo.
  useEffect(() => {
    let cancelled = false;
    if (!destination.coordinates || !trip?.start_date || !trip?.end_date) {
      setWeather([]);
      return;
    }
    setWeatherLoading(true);
    fetchWeather(
      destination.coordinates.lat,
      destination.coordinates.lng,
      trip.start_date,
      trip.end_date
    )
      .then((w) => {
        if (!cancelled) setWeather(w.slice(0, 7));
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destination.coordinates, trip?.start_date, trip?.end_date]);

  // Fire-and-forget: cache into destinations_cache if stale (>3h).
  useEffect(() => {
    if (!weather.length || !trip?.country_code) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("destinations_cache")
          .select("country_code, weather_cached_at")
          .eq("country_code", trip.country_code)
          .maybeSingle();
        const cachedAt = data?.weather_cached_at
          ? new Date(data.weather_cached_at).getTime()
          : 0;
        const threeHours = 3 * 60 * 60 * 1000;
        if (Date.now() - cachedAt < threeHours) return;
        await supabase
          .from("destinations_cache")
          .upsert(
            {
              country_code: trip.country_code,
              weather_cache: weather,
              weather_cached_at: new Date().toISOString(),
            },
            { onConflict: "country_code" }
          );
      } catch {
        /* non-fatal */
      }
    })();
  }, [weather, trip?.country_code]);

  // Filter attractions client-side based on tags/keywords/fields.
  const filteredAttractions = useMemo(() => {
    if (filter === "all") return destination.attractions;
    return destination.attractions.filter((a) => matchesFilter(a, filter));
  }, [destination.attractions, filter]);

  return (
    <div className="space-y-6">
      {/* Editorial Hero */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-[55vh] md:h-[70vh] min-h-[360px] md:min-h-[520px] rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
      >
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={destination.hero_image}
            alt={destination.country}
            className="w-full h-full object-cover animate-ken-burns"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
        <div className="noise-overlay absolute inset-0 pointer-events-none" />

        <div className="absolute top-5 right-6 left-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] font-serif italic opacity-80">
            <span className="h-px w-6 bg-[var(--gold-500)]" />
            יעד
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] opacity-80">
            {destination.country}
          </div>
        </div>

        <div className="absolute bottom-0 right-0 left-0 p-6 md:p-10 text-white">
          <motion.h2
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif font-black leading-[0.95] tracking-tight"
            style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }}
          >
            {destination.name}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-3 max-w-2xl text-sm md:text-base text-white/85 leading-relaxed font-serif"
          >
            {destination.description}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-5 flex items-stretch gap-4 text-white/90 pt-4 border-t border-[var(--gold-500)]/40"
          >
            <StatColumn label="מטבע" value={`${destination.currency_symbol} ${destination.currency}`} />
            <div className="w-px bg-[var(--gold-500)]/30" />
            <StatColumn label="שפה" value={destination.language} />
            <div className="w-px bg-[var(--gold-500)]/30" />
            <StatColumn label="אזור זמן" value={destination.timezone.split("(")[0].trim()} />
          </motion.div>
        </div>
      </motion.div>

      {/* Weather Strip */}
      <WeatherStrip
        weather={weather}
        loading={weatherLoading}
        hasCoordinates={!!destination.coordinates}
      />

      {/* Quick Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="glass rounded-2xl p-4">
          <Globe className="h-4 w-4 text-blue-400 mb-2" />
          <div className="text-xs text-muted-foreground">שפה</div>
          <div className="text-sm font-semibold">{destination.language}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <Clock className="h-4 w-4 text-purple-400 mb-2" />
          <div className="text-xs text-muted-foreground">אזור זמן</div>
          <div className="text-sm font-semibold">{destination.timezone.split("(")[0]}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <Plane className="h-4 w-4 text-teal-400 mb-2" />
          <div className="text-xs text-muted-foreground">שדה תעופה</div>
          <div className="text-sm font-semibold">{destination.airport.code}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <AlertCircle className="h-4 w-4 text-red-400 mb-2" />
          <div className="text-xs text-muted-foreground">חירום</div>
          <div className="text-sm font-semibold">{destination.emergency_phone}</div>
        </div>
      </motion.div>

      {/* Currency Converter */}
      {rates && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl overflow-hidden gradient-blue text-white p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <TrendingUp className="h-3 w-3" />
                שער חליפין חי
              </div>
              <h3 className="text-lg font-bold mt-1">
                ₪1 = {destination.currency_symbol}
                {(1 / (rates[destination.currency] ? 1 / rates[destination.currency] : 1)).toFixed(3)}
              </h3>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-xs">מתעדכן כל שעה</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/20">
            {[100, 500, 1000].map((ils) => (
              <div key={ils} className="text-center">
                <div className="text-xs text-white/70">₪{ils}</div>
                <div className="font-bold text-lg">
                  {destination.currency_symbol}
                  {rates[destination.currency]
                    ? (ils * rates[destination.currency]).toFixed(0)
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Chabad Houses */}
      {destination.chabad.length > 0 && !isDomestic && (
        <Section title="בית חב״ד" icon="🕎" delay={0.1}>
          <div className="grid gap-3 md:grid-cols-2">
            {destination.chabad.map((ch, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-2xl glass glass-hover p-4 space-y-2"
              >
                <div>
                  <h4 className="font-bold">{ch.name}</h4>
                  <p className="text-xs text-muted-foreground">{ch.rabbi}</p>
                </div>
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{ch.address}</span>
                </div>
                {ch.services && (
                  <div className="flex flex-wrap gap-1">
                    {ch.services.map((s, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={`tel:${ch.phone}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    התקשר
                  </a>
                  {ch.whatsapp && (
                    <a
                      href={`https://wa.me/${ch.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      וואטסאפ
                    </a>
                  )}
                  <a
                    href={ch.google_maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 transition-colors"
                  >
                    <Navigation className="h-3 w-3" />
                    ניווט
                  </a>
                  {ch.website && (
                    <a
                      href={ch.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-xs hover:text-foreground transition-colors"
                    >
                      <Globe className="h-3 w-3" />
                      אתר
                    </a>
                  )}
                </div>
                {ch.notes && (
                  <p className="text-xs text-muted-foreground italic pt-1">💡 {ch.notes}</p>
                )}
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* Kosher Restaurants */}
      {destination.restaurants.length > 0 && (
        <Section title="מסעדות כשרות" icon="🍽️" delay={0.1}>
          <div className="grid gap-3 md:grid-cols-2">
            {destination.restaurants.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="rounded-2xl glass glass-hover p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold">{r.name}</h4>
                    <p className="text-xs text-muted-foreground">{r.certification}</p>
                  </div>
                  <Badge
                    className={`text-xs ${
                      r.type === "meat"
                        ? "bg-red-500/20 text-red-400"
                        : r.type === "dairy"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                    } border-0`}
                  >
                    {r.type === "meat" ? "🥩 בשרי" : r.type === "dairy" ? "🧀 חלבי" : "🥬 פרווה"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{r.address}</span>
                </div>
                {r.hours && (
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{r.hours}</span>
                  </div>
                )}
                {r.specialties && (
                  <div className="flex flex-wrap gap-1">
                    {r.specialties.map((s, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {r.phone && (
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                    >
                      <Phone className="h-3 w-3" />
                      התקשר
                    </a>
                  )}
                  {r.whatsapp && (
                    <a
                      href={`https://wa.me/${r.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30"
                    >
                      <MessageCircle className="h-3 w-3" />
                      וואטסאפ
                    </a>
                  )}
                  <a
                    href={r.google_maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30"
                  >
                    <Navigation className="h-3 w-3" />
                    ניווט
                  </a>
                </div>
                {r.notes && (
                  <p className="text-xs text-muted-foreground italic pt-1">💡 {r.notes}</p>
                )}
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* Attractions */}
      {destination.attractions.length > 0 && (
        <Section title="אטרקציות ומקומות חובה" icon="📍" delay={0.1}>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(FILTER_LABELS) as AttractionFilter[]).map((key) => {
              const active = filter === key;
              const Icon = FILTER_ICONS[key];
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                    active
                      ? "bg-[var(--gold-500)]/20 border-[var(--gold-500)]/60 text-[var(--gold-200)]"
                      : "glass border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {FILTER_LABELS[key]}
                </button>
              );
            })}
          </div>

          {filteredAttractions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center glass rounded-2xl">
              אין אטרקציות שתואמות לסינון זה
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredAttractions.map((a, i) => (
                <AttractionCard
                  key={i}
                  attraction={a}
                  index={i}
                  days={days}
                  tripId={trip?.id}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Lodging */}
      <Section title="מקומות לינה קרובים" icon="🏨" delay={0.15}>
        <div className="grid gap-3 md:grid-cols-2">
          <AffiliateCard
            icon={<Building2 className="h-5 w-5 text-blue-400" />}
            title="Booking.com"
            subtitle="מלונות ודירות נופש"
            href={`https://www.booking.com/searchresults.html?ss=${destinationQuery}`}
            gradient="from-blue-500/20 to-blue-500/5"
          />
          {!isDomestic && (
            <AffiliateCard
              icon={<Home className="h-5 w-5 text-pink-400" />}
              title="Airbnb"
              subtitle="דירות מקומיות"
              href={`https://www.airbnb.com/s/${destinationQuery}`}
              gradient="from-pink-500/20 to-pink-500/5"
            />
          )}
        </div>
        {!isDomestic && destination.chabad.length > 0 && destination.chabad[0].address && (
          <p className="text-xs text-amber-300/80 mt-3 flex items-center gap-1.5">
            🕎 מומלץ לחפש לינה קרוב לבית חב״ד — {destination.chabad[0].address}
          </p>
        )}
      </Section>

      {/* Car Rental */}
      <Section
        title={isDomestic ? "טיולי רכב בארץ" : "השכרת רכב"}
        icon="🚗"
        delay={0.2}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <AffiliateCard
            icon={<Car className="h-5 w-5 text-emerald-400" />}
            title="Rentalcars"
            subtitle="השוואת מחירים"
            href={`https://www.rentalcars.com/SearchResults.do?location=${destinationQuery}`}
            gradient="from-emerald-500/20 to-emerald-500/5"
          />
          <AffiliateCard
            icon={<Car className="h-5 w-5 text-orange-400" />}
            title="Kayak"
            subtitle="השוואת מחירים + מטא-חיפוש"
            href={`https://www.kayak.com/cars/${destinationQuery}`}
            gradient="from-orange-500/20 to-orange-500/5"
          />
        </div>
      </Section>

      {/* Shopping Centers */}
      {destination.shopping_centers.length > 0 && (
        <Section title="סופרמרקטים וקניות" icon="🛒" delay={0.2}>
          <div className="grid gap-2 md:grid-cols-2">
            {destination.shopping_centers.map((s, i) => (
              <a
                key={i}
                href={s.google_maps}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl glass glass-hover p-4 flex items-start gap-3 hover:shadow-lg transition-all"
              >
                <ShoppingBag className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.address}</div>
                  {s.notes && <div className="text-xs text-amber-400 mt-1">💡 {s.notes}</div>}
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Halachic Notes */}
      {destination.halachic_notes && destination.halachic_notes.length > 0 && !isDomestic && (
        <Section title="הערות הלכתיות" icon="📖" delay={0.2}>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
            <ul className="space-y-2">
              {destination.halachic_notes.map((n, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* Legacy weather note */}
      {destination.weather_note && !weather.length && (
        <div className="rounded-2xl glass p-4 flex items-start gap-3">
          <div className="text-2xl">🌤️</div>
          <div>
            <div className="font-semibold text-sm">מזג אוויר</div>
            <div className="text-xs text-muted-foreground">{destination.weather_note}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

const FILTER_ICONS: Record<AttractionFilter, React.ComponentType<{ className?: string }> | null> = {
  all: null,
  hiking: Mountain,
  paid: Ticket,
  free: Gift,
  kid_friendly: Baby,
};

function matchesFilter(a: Attraction, filter: AttractionFilter): boolean {
  const txt = `${a.name} ${a.description} ${a.type}`.toLowerCase();
  switch (filter) {
    case "hiking":
      return (
        a.type === "nature" ||
        a.type === "viewpoint" ||
        /hik|trail|הליכ|טיול רגלי|שביל|מסלול|הר/.test(txt)
      );
    case "paid": {
      // "paid" if there is a price AND it is not free
      const price = (a.price || "").toLowerCase();
      if (!price) return false;
      return !/חינם|free|0€|0 €/.test(price);
    }
    case "free": {
      const price = (a.price || "").toLowerCase();
      return !price || /חינם|free/.test(price);
    }
    case "kid_friendly":
      return !!a.kids_friendly || a.type === "kids" || /ילד|kid|children/.test(txt);
    default:
      return true;
  }
}

function WeatherStrip({
  weather,
  loading,
  hasCoordinates,
}: {
  weather: WeatherDay[];
  loading: boolean;
  hasCoordinates: boolean;
}) {
  if (!hasCoordinates) {
    return (
      <div className="rounded-2xl glass p-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="text-2xl">🌤️</span>
        מזג אוויר לא זמין ליעד זה
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-2xl glass p-4 text-sm text-muted-foreground">
        טוען תחזית מזג אוויר…
      </div>
    );
  }
  if (!weather.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl glass p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="text-lg">🌤️</span> תחזית ל-{weather.length} ימים
        </h3>
        <Badge variant="secondary" className="text-[10px]">Open-Meteo</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
        {weather.map((day) => {
          const dt = new Date(day.date);
          const label = dt.toLocaleDateString("he-IL", {
            weekday: "short",
            day: "numeric",
            month: "numeric",
          });
          return (
            <div
              key={day.date}
              className="shrink-0 w-24 rounded-xl bg-white/5 border border-white/10 p-3 text-center"
            >
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className="text-2xl my-1">{day.icon}</div>
              <div className="text-xs font-semibold">
                {Math.round(day.temp_max)}° / {Math.round(day.temp_min)}°
              </div>
              {day.precipitation > 0 && (
                <div className="text-[10px] text-blue-400 mt-0.5">
                  💧 {day.precipitation.toFixed(1)}מ״מ
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AttractionCard({
  attraction: a,
  index,
  days,
  tripId,
}: {
  attraction: Attraction;
  index: number;
  days: TripDay[];
  tripId?: string;
}) {
  const [booking, setBooking] = useState(false);

  async function addBooking(dayId: string) {
    if (!tripId) return;
    setBooking(true);
    try {
      const supabase = createClient();
      const { data: current } = await supabase
        .from("trip_days")
        .select("bookings")
        .eq("id", dayId)
        .maybeSingle();
      const existing = Array.isArray(current?.bookings) ? current!.bookings : [];
      const newBookings = [
        ...existing,
        {
          attraction_id: `${tripId}-${a.name}`,
          attraction_name: a.name,
          time: null,
          created_at: new Date().toISOString(),
        },
      ];
      const { error } = await supabase
        .from("trip_days")
        .update({ bookings: newBookings })
        .eq("id", dayId);
      if (error) throw error;
      toast.success(`נוספה הזמנה: ${a.name}`);
    } catch (err) {
      toast.error("שגיאה בשמירת ההזמנה");
    } finally {
      setBooking(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.03 }}
      className="rounded-2xl glass glass-hover overflow-hidden group"
    >
      {a.image && (
        <div className="h-40 overflow-hidden">
          <img
            src={a.image}
            alt={a.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-bold flex items-center gap-2">
            {a.must_visit && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
            {a.name}
          </h4>
          <Badge variant="secondary" className="text-xs shrink-0">
            {ATTRACTION_TYPE_LABELS[a.type]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
        <div className="flex flex-wrap gap-2 text-xs pt-1">
          {a.price && <span className="text-green-400">💰 {a.price}</span>}
          {a.duration && <span className="text-muted-foreground">⏱️ {a.duration}</span>}
          {a.kids_friendly && <span className="text-amber-400">👨‍👩‍👧‍👦 מתאים לילדים</span>}
        </div>
        {a.hours && <p className="text-xs text-muted-foreground">🕐 {a.hours}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={a.google_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30"
          >
            <Navigation className="h-3 w-3" />
            מפה
          </a>
          {a.website && (
            <a
              href={a.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-xs hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              אתר
            </a>
          )}
          {tripId && days.length > 0 && (
            <Popover>
              <PopoverTrigger
                disabled={booking}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--gold-500)]/20 text-[var(--gold-200)] text-xs hover:bg-[var(--gold-500)]/30 disabled:opacity-50"
              >
                <CalendarPlus className="h-3 w-3" />
                📅 שריין ליום
              </PopoverTrigger>
              <PopoverContent className="w-60 p-2" align="start">
                <div className="text-xs text-muted-foreground mb-2 px-2">בחר יום לטיול:</div>
                <div className="max-h-60 overflow-auto flex flex-col gap-1">
                  {days.map((d) => {
                    const dt = new Date(d.date);
                    return (
                      <button
                        key={d.id}
                        onClick={() => addBooking(d.id)}
                        disabled={booking}
                        className="text-right text-xs px-2 py-1.5 rounded hover:bg-white/5 disabled:opacity-50"
                      >
                        {dt.toLocaleDateString("he-IL", {
                          weekday: "long",
                          day: "numeric",
                          month: "numeric",
                        })}
                        {d.hebrew_date && (
                          <span className="text-muted-foreground mr-2">· {d.hebrew_date}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AffiliateCard({
  icon,
  title,
  subtitle,
  href,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  gradient: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`rounded-2xl glass glass-hover p-4 flex items-center gap-3 bg-gradient-to-br ${gradient} hover:scale-[1.01] transition-all`}
    >
      <div className="shrink-0 p-2 rounded-xl bg-white/10">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  );
}

const ATTRACTION_TYPE_LABELS: Record<string, string> = {
  nature: "טבע",
  historic: "היסטוריה",
  beach: "חוף",
  museum: "מוזיאון",
  activity: "פעילות",
  viewpoint: "תצפית",
  religious: "דת",
  kids: "ילדים",
};

function Section({
  title,
  icon,
  delay = 0,
  children,
}: {
  title: string;
  icon: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
    >
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--gold-200)]/70 font-serif italic mb-1">
        {label}
      </div>
      <div className="text-xs md:text-sm font-serif font-medium truncate">{value}</div>
    </div>
  );
}
