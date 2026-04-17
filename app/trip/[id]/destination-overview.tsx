"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Utensils,
  ChefHat,
  Camera,
  ShoppingBag,
  Plane,
} from "lucide-react";
import type { DestinationInfo } from "@/lib/destinations";
import { formatMoney } from "@/lib/currency";

interface DestinationOverviewProps {
  destination: DestinationInfo;
  rates: Record<string, number> | null;
}

export function DestinationOverview({ destination, rates }: DestinationOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Editorial Hero — full-bleed magazine cover */}
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
        {/* Editorial layered gradients: deep bottom for text, subtle top for masthead */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
        {/* Noise grain */}
        <div className="noise-overlay absolute inset-0 pointer-events-none" />

        {/* Masthead */}
        <div className="absolute top-5 right-6 left-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] font-serif italic opacity-80">
            <span className="h-px w-6 bg-[var(--gold-500)]" />
            יעד
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] opacity-80">
            {destination.country}
          </div>
        </div>

        {/* Hero title + description */}
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
          {/* Editorial stat rules */}
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
                {(1 / (rates[destination.currency] ? 1 / rates[destination.currency] : 1)).toFixed(
                  3
                )}
              </h3>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-xs">
              מתעדכן כל שעה
            </Badge>
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
      {destination.chabad.length > 0 && (
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
                  <p className="text-xs text-muted-foreground italic pt-1">
                    💡 {ch.notes}
                  </p>
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
          <div className="grid gap-3 md:grid-cols-2">
            {destination.attractions.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.03 }}
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
                    {a.price && (
                      <span className="text-green-400">💰 {a.price}</span>
                    )}
                    {a.duration && (
                      <span className="text-muted-foreground">⏱️ {a.duration}</span>
                    )}
                    {a.kids_friendly && (
                      <span className="text-amber-400">👨‍👩‍👧‍👦 מתאים לילדים</span>
                    )}
                  </div>
                  {a.hours && (
                    <p className="text-xs text-muted-foreground">🕐 {a.hours}</p>
                  )}
                  <div className="flex gap-2 pt-2">
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
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

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
                  {s.notes && (
                    <div className="text-xs text-amber-400 mt-1">💡 {s.notes}</div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Halachic Notes */}
      {destination.halachic_notes && destination.halachic_notes.length > 0 && (
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

      {/* Weather */}
      {destination.weather_note && (
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
