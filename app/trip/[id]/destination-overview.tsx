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
  Search,
  Fish,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { DestinationInfo, Attraction } from "@/lib/destinations";
import type { Trip, TripDay } from "@/lib/supabase/types";
import { fetchWeather, geocode, type WeatherDay } from "@/lib/weather";

type AttractionFilter = "all" | "hiking" | "paid" | "free" | "kid_friendly";

interface LocalCustomsHoliday {
  name: string;
  dates: string;
  description: string;
  affects_trip: boolean;
}

interface Recommendation {
  id: string;
  destination: string;
  source: "reddit" | "tripadvisor" | "facebook" | "blog" | "claude" | null;
  source_url: string | null;
  title: string | null;
  quote: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  popularity_score: number | null;
  tags: string[] | null;
  collected_at: string | null;
}

interface LocalCustoms {
  overview: string;
  special_holidays: LocalCustomsHoliday[];
  etiquette: string[];
  tipping: string;
  dress_code: string;
  languages: string[];
  what_closes_on_holidays: string;
}

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
  const [customs, setCustoms] = useState<LocalCustoms | null>(null);
  const [customsLoading, setCustomsLoading] = useState(false);
  // Coordinates resolved via geocoding fallback when DESTINATIONS_DB has none.
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Geocoded coordinates for each Chabad house, keyed by address.
  const [chabadCoords, setChabadCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  // Stage 8 — "What's hot" recommendations from trip_recommendations.
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const isDomestic = trip?.location_type === "domestic";
  const accLat = trip?.accommodation_lat ?? null;
  const accLng = trip?.accommodation_lng ?? null;
  const hasAccommodation =
    !isDomestic && typeof accLat === "number" && typeof accLng === "number";
  const destinationQuery = encodeURIComponent(trip?.destination || destination.country);

  // Affiliate-aware URLs. Env vars fall back to empty strings; clean URLs when unset.
  const bookingAid = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID || "";
  const airbnbAf = process.env.NEXT_PUBLIC_AIRBNB_AFFILIATE_ID || "";
  const rentalcarsAff = process.env.NEXT_PUBLIC_RENTALCARS_AFFILIATE_ID || "";

  const bookingHref =
    `https://www.booking.com/searchresults.html?ss=${destinationQuery}` +
    (bookingAid ? `&aid=${encodeURIComponent(bookingAid)}` : "");
  const airbnbHref = airbnbAf
    ? `https://www.airbnb.com/s/${destinationQuery}?enable_i18n=true&af=${encodeURIComponent(airbnbAf)}`
    : `https://www.airbnb.com/s/${destinationQuery}`;
  const rentalcarsHref =
    `https://www.rentalcars.com/SearchResults.do?location=${destinationQuery}` +
    (rentalcarsAff ? `&affiliateCode=${encodeURIComponent(rentalcarsAff)}` : "");
  const kayakHref = `https://www.kayak.com/cars/${destinationQuery}`;

  // Effective coordinates: prefer static DB, otherwise the geocoded fallback.
  const effectiveCoords = destination.coordinates
    ? { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
    : geoCoords;

  // Geocoding fallback — if no static coordinates, resolve via Open-Meteo.
  useEffect(() => {
    let cancelled = false;
    if (destination.coordinates) {
      setGeoCoords(null);
      return;
    }
    const q = trip?.destination || destination.country || destination.name;
    if (!q) return;
    geocode(q).then((g) => {
      if (cancelled || !g) return;
      setGeoCoords({ lat: g.lat, lng: g.lng });
    });
    return () => {
      cancelled = true;
    };
  }, [destination.coordinates, destination.country, destination.name, trip?.destination]);

  // Load weather (client-side). Needs trip dates + effective coordinates.
  useEffect(() => {
    let cancelled = false;
    if (!effectiveCoords || !trip?.start_date || !trip?.end_date) {
      setWeather([]);
      return;
    }
    setWeatherLoading(true);
    fetchWeather(
      effectiveCoords.lat,
      effectiveCoords.lng,
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
  }, [effectiveCoords?.lat, effectiveCoords?.lng, trip?.start_date, trip?.end_date]);

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

  // Fetch local customs (international trips only). Uses /api/destinations/customs.
  useEffect(() => {
    if (isDomestic) {
      setCustoms(null);
      return;
    }
    if (!trip?.start_date || !trip?.end_date) return;
    const dest = trip?.destination || destination.country || destination.name;
    if (!dest) return;
    let cancelled = false;
    setCustomsLoading(true);
    fetch("/api/destinations/customs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: dest,
        startDate: trip.start_date,
        endDate: trip.end_date,
        countryCode: trip.country_code || destination.country_code,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.customs) setCustoms(data.customs as LocalCustoms);
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setCustomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isDomestic,
    trip?.destination,
    trip?.start_date,
    trip?.end_date,
    trip?.country_code,
    destination.country,
    destination.country_code,
    destination.name,
  ]);

  // Geocode Chabad addresses when we have accommodation coordinates.
  // Runs once per unique address. Failures are silent (no badge is shown).
  useEffect(() => {
    if (!hasAccommodation) return;
    let cancelled = false;
    const addrs = destination.chabad
      .map((c) => c.address)
      .filter((a): a is string => !!a && !chabadCoords[a]);
    if (addrs.length === 0) return;
    (async () => {
      for (const addr of addrs) {
        const g = await geocode(addr);
        if (cancelled) return;
        if (g) {
          setChabadCoords((prev) => ({
            ...prev,
            [addr]: { lat: g.lat, lng: g.lng },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccommodation, destination.chabad, chabadCoords]);

  // Stage 8 — Fetch "What's Hot" recommendations (international only).
  useEffect(() => {
    if (isDomestic) {
      setRecommendations(null);
      return;
    }
    const dest = trip?.destination || destination.country || destination.name;
    if (!dest) return;
    let cancelled = false;
    setRecommendationsLoading(true);
    fetch(
      `/api/recommendations/for-destination?destination=${encodeURIComponent(dest)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRecommendations(
          Array.isArray(data?.items) ? (data.items as Recommendation[]) : []
        );
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDomestic, trip?.destination, destination.country, destination.name]);

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

      {/* Flight Summary */}
      {trip && (
        <FlightSummary trip={trip} isDomestic={isDomestic} />
      )}

      {/* Weather Strip */}
      <WeatherStrip
        weather={weather}
        loading={weatherLoading}
        hasCoordinates={!!effectiveCoords}
      />

      {/* Local Customs (international only) */}
      {!isDomestic && (
        <CustomsCard customs={customs} loading={customsLoading} />
      )}

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
                {hasAccommodation && chabadCoords[ch.address] && (
                  <WalkingBadge
                    fromLat={accLat as number}
                    fromLng={accLng as number}
                    toLat={chabadCoords[ch.address].lat}
                    toLng={chabadCoords[ch.address].lng}
                  />
                )}
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

      {/* Jewish services search (international only) */}
      {!isDomestic && (
        <Section title="חיפוש שירותים יהודיים" icon="🔍" delay={0.12}>
          <JewishServicesGrid destinationQuery={destinationQuery} />
        </Section>
      )}

      {/* Fresh fish markets (both domestic & international) */}
      <Section title="דגים טריים" icon="🐟" delay={0.14}>
        <FishMarketsCard
          destinationQuery={destinationQuery}
          kosherHint={!isDomestic}
        />
      </Section>

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
            href={bookingHref}
            gradient="from-blue-500/20 to-blue-500/5"
          />
          {!isDomestic && (
            <AffiliateCard
              icon={<Home className="h-5 w-5 text-pink-400" />}
              title="Airbnb"
              subtitle="דירות מקומיות"
              href={airbnbHref}
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
            href={rentalcarsHref}
            gradient="from-emerald-500/20 to-emerald-500/5"
          />
          <AffiliateCard
            icon={<Car className="h-5 w-5 text-orange-400" />}
            title="Kayak"
            subtitle="השוואת מחירים + מטא-חיפוש"
            href={kayakHref}
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
      // "paid" if price explicitly set (non-free) OR name/description hints at a fee.
      const price = (a.price || "").toLowerCase();
      const freeRx = /חינם|free|ללא תשלום|חופשי|no charge|0€|0 €|0\$|0 \$/;
      if (price && !freeRx.test(price)) return true;
      // Keyword-based detection across Hebrew + English on name/desc/price.
      const paidRx = /כרטיס|כניסה|תשלום|עלות|₪|ticket|entrance|admission|fee|price|\$|€/i;
      return paidRx.test(txt) || paidRx.test(price);
    }
    case "free": {
      const price = (a.price || "").toLowerCase();
      const freeRx = /חינם|free|ללא תשלום|חופשי|no charge/i;
      // Free if no price, explicit zero, free keyword in price, or free keyword in text.
      if (!price) return true; // no price field → treat as likely free (legacy behavior)
      if (/^0\b|חינם|free|ללא תשלום|חופשי|no charge/i.test(price)) return true;
      return freeRx.test(txt);
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
    // No coordinates even after geocoding fallback — render nothing (rare).
    return null;
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

// Haversine distance in kilometers between two lat/lng pairs.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function WalkingBadge({
  fromLat,
  fromLng,
  toLat,
  toLng,
}: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}) {
  const km = haversineKm(fromLat, fromLng, toLat, toLng);
  // Avg walking speed: 80 m/min → 4.8 km/h
  const walkMin = Math.ceil((km * 1000) / 80);
  if (walkMin <= 30) {
    return (
      <Badge variant="secondary" className="text-xs bg-green-500/15 text-green-400 border-0 w-fit">
        🚶 {walkMin} דק׳ הליכה
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-400 border-0 w-fit">
      🚗 {km.toFixed(1)} ק״מ
    </Badge>
  );
}

function CustomsCard({
  customs,
  loading,
}: {
  customs: LocalCustoms | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl glass p-4 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-3" />
        <div className="h-3 w-full bg-white/5 rounded mb-2" />
        <div className="h-3 w-2/3 bg-white/5 rounded" />
      </div>
    );
  }
  if (!customs || !customs.overview) return null;
  const hasHolidays = customs.special_holidays && customs.special_holidays.length > 0;
  const hasEtiquette = customs.etiquette && customs.etiquette.length > 0;
  const quickFacts = [
    customs.tipping && { label: "תשר", value: customs.tipping },
    customs.dress_code && { label: "לבוש", value: customs.dress_code },
    customs.languages?.length && { label: "שפות", value: customs.languages.join(" · ") },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="rounded-2xl glass p-5"
    >
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <span className="text-lg">🌍</span> מנהגי המקום
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{customs.overview}</p>

      {hasHolidays && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--gold-200)]">
            אירועים וחגים בתקופת הטיול
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {customs.special_holidays.map((h, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 border ${
                  h.affects_trip
                    ? "bg-[var(--gold-500)]/10 border-[var(--gold-500)]/50"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="text-sm font-semibold flex items-center gap-1">
                  {h.affects_trip && <span>⚠️</span>}
                  {h.name}
                </div>
                <div className="text-[11px] text-muted-foreground">{h.dates}</div>
                <div className="text-xs mt-1">{h.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasEtiquette && (
        <div className="mt-4">
          <div className="text-xs font-semibold mb-2">טיפים תרבותיים</div>
          <ul className="space-y-1">
            {customs.etiquette.map((t, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-[var(--gold-200)] mt-0.5">✦</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {customs.what_closes_on_holidays && (
        <div className="mt-3 text-xs text-amber-300/90 bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20">
          🛑 {customs.what_closes_on_holidays}
        </div>
      )}

      {quickFacts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/10">
          {quickFacts.map((f, i) => (
            <div
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10"
            >
              <span className="text-muted-foreground">{f.label}: </span>
              <span className="font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function FishMarketsCard({
  destinationQuery,
  kosherHint,
}: {
  destinationQuery: string;
  kosherHint: boolean;
}) {
  const gmapsQuery = kosherHint
    ? `fresh+fish+market+${destinationQuery}+kosher`
    : `fresh+fish+market+${destinationQuery}`;
  const gmapsHref = `https://www.google.com/maps/search/${gmapsQuery}`;
  const wazeHref = `https://waze.com/ul?q=fresh+fish+market+${destinationQuery}&navigate=yes`;
  return (
    <div className="rounded-2xl glass p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 p-2 rounded-xl bg-cyan-500/20">
          <Fish className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <div className="font-semibold text-sm">חנויות דגים טריים קרובים</div>
          <div className="text-xs text-muted-foreground">
            חפש סימן &quot;fresh&quot; או &quot;טרי&quot; וימי אספקה
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <a
          href={gmapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-3 text-xs flex items-center gap-2 transition-colors"
        >
          <Search className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-medium">חיפוש Google Maps</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground mr-auto" />
        </a>
        <a
          href={wazeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-3 text-xs flex items-center gap-2 transition-colors"
        >
          <Navigation className="h-3.5 w-3.5 text-purple-400" />
          <span className="font-medium">חיפוש Waze</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground mr-auto" />
        </a>
      </div>
    </div>
  );
}

function JewishServicesGrid({ destinationQuery }: { destinationQuery: string }) {
  const items: { icon: string; label: string; query: string }[] = [
    { icon: "🕍", label: "בתי כנסת", query: `synagogue+${destinationQuery}` },
    { icon: "🛁", label: "מקוואות", query: `mikvah+${destinationQuery}` },
    { icon: "🥩", label: "קצביות כשרות", query: `kosher+butcher+${destinationQuery}` },
    { icon: "🍞", label: "מאפיות כשרות", query: `kosher+bakery+${destinationQuery}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it, i) => (
        <a
          key={i}
          href={`https://www.google.com/maps/search/${it.query}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl glass glass-hover p-4 flex items-center gap-3 transition-all hover:scale-[1.01]"
        >
          <div className="text-2xl shrink-0">{it.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{it.label}</div>
            <div className="text-[11px] text-muted-foreground">חיפוש Google Maps</div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </a>
      ))}
    </div>
  );
}

interface FlightStatusRow {
  flight_number: string;
  scheduled_datetime: string;
  current_datetime: string | null;
  current_terminal: string | null;
  status: string | null;
  checked_at: string | null;
}

function FlightSummary({ trip, isDomestic }: { trip: Trip; isDomestic: boolean }) {
  const hasOut = !!(trip.outbound_flight_number || trip.outbound_flight_datetime);
  const hasRet = !!(trip.return_flight_number || trip.return_flight_datetime);

  // Latest flight_status_log record per flight_number (Stage 7).
  const [statusMap, setStatusMap] = useState<Record<string, FlightStatusRow>>({});
  useEffect(() => {
    if (isDomestic || (!hasOut && !hasRet)) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("flight_status_log")
          .select(
            "flight_number, scheduled_datetime, current_datetime, current_terminal, status, checked_at"
          )
          .eq("trip_id", trip.id)
          .order("checked_at", { ascending: false });
        if (cancelled || !data) return;
        const latest: Record<string, FlightStatusRow> = {};
        for (const row of data as FlightStatusRow[]) {
          if (!latest[row.flight_number]) latest[row.flight_number] = row;
        }
        setStatusMap(latest);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip.id, isDomestic, hasOut, hasRet]);

  if (!hasOut && !hasRet) return null;

  const fmt = (iso?: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("he-IL", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const title = isDomestic ? "🚗 נסיעה" : "✈️ טיסות";
  const outLabel = isDomestic ? "יציאה" : "הלוך";
  const retLabel = isDomestic ? "חזרה" : "חזור";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl glass p-4"
    >
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <Plane className="h-4 w-4 text-teal-400" />
        {title}
      </h3>
      <div className="grid gap-2 md:grid-cols-2">
        {hasOut && (
          <FlightLine
            label={outLabel}
            number={trip.outbound_flight_number}
            airport={trip.outbound_airport}
            terminal={trip.outbound_terminal}
            datetime={fmt(trip.outbound_flight_datetime)}
            scheduledIso={trip.outbound_flight_datetime}
            live={trip.outbound_flight_number ? statusMap[trip.outbound_flight_number] : undefined}
          />
        )}
        {hasRet && (
          <FlightLine
            label={retLabel}
            number={trip.return_flight_number}
            airport={trip.return_airport}
            terminal={trip.return_terminal}
            datetime={fmt(trip.return_flight_datetime)}
            scheduledIso={trip.return_flight_datetime}
            live={trip.return_flight_number ? statusMap[trip.return_flight_number] : undefined}
          />
        )}
      </div>
    </motion.div>
  );
}

function FlightLine({
  label,
  number,
  airport,
  terminal,
  datetime,
  scheduledIso,
  live,
}: {
  label: string;
  number?: string | null;
  airport?: string | null;
  terminal?: string | null;
  datetime?: string;
  scheduledIso?: string | null;
  live?: FlightStatusRow;
}) {
  // Compute live-status badge (Stage 7).
  let statusBadge: { text: string; cls: string } | null = null;
  if (live) {
    const status = live.status;
    if (status === "cancelled") {
      statusBadge = {
        text: "🚫 בוטלה",
        cls: "bg-red-500/20 border-red-500/40 text-red-200",
      };
    } else if (status === "delayed" && scheduledIso && live.current_datetime) {
      const delayMin = Math.round(
        (new Date(live.current_datetime).getTime() -
          new Date(scheduledIso).getTime()) /
          60000
      );
      if (delayMin >= 5) {
        statusBadge = {
          text: `⚠️ עיכוב ${delayMin} דק׳`,
          cls: "bg-yellow-500/20 border-yellow-500/40 text-yellow-200",
        };
      }
    } else if (
      live.current_terminal &&
      terminal &&
      String(live.current_terminal) !== String(terminal)
    ) {
      statusBadge = {
        text: `🔄 טרמינל שונה: T${live.current_terminal}`,
        cls: "bg-orange-500/20 border-orange-500/40 text-orange-200",
      };
    }
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">{label}</Badge>
        {number && <span className="font-semibold tracking-wide" dir="ltr">{number}</span>}
        {statusBadge && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge.cls}`}
          >
            {statusBadge.text}
          </span>
        )}
      </div>
      <div className="text-muted-foreground">
        {airport && <span dir="ltr">{airport}</span>}
        {terminal && <span> · טרמינל {terminal}</span>}
      </div>
      {datetime && <div className="text-muted-foreground mt-0.5">{datetime}</div>}
    </div>
  );
}

function WhatsHotCard({
  items,
  loading,
}: {
  items: Recommendation[] | null;
  loading: boolean;
}) {
  if (loading && !items) {
    return (
      <div className="rounded-2xl glass p-4 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-28 w-64 bg-white/5 rounded-xl shrink-0" />
          <div className="h-28 w-64 bg-white/5 rounded-xl shrink-0" />
        </div>
      </div>
    );
  }

  const list = items ?? [];
  const top = list.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.17 }}
      className="rounded-2xl glass p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="text-lg">🔥</span> מה חם עכשיו
        </h3>
        {top.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {top.length} המלצות טריות
          </Badge>
        )}
      </div>

      {top.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          איסוף המלצות מתבצע ברקע — נחזור אליך בהקדם
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth">
          {top.map((rec) => {
            const score = rec.popularity_score ?? 0;
            const badgeCls =
              score >= 80
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : score >= 60
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                : "bg-white/10 text-muted-foreground border-white/10";
            const quote =
              rec.quote && rec.quote.length > 140
                ? rec.quote.slice(0, 140) + "…"
                : rec.quote || "";
            return (
              <div
                key={rec.id}
                className="shrink-0 w-64 rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm leading-snug flex-1">
                    {rec.title || "המלצה"}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeCls}`}
                  >
                    🔥 {score}
                  </span>
                </div>
                {quote && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    &ldquo;{quote}&rdquo;
                  </p>
                )}
                {rec.tags && rec.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.tags.slice(0, 3).map((t, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {rec.source_url && (
                  <a
                    href={rec.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {rec.source || "מקור"}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
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
