import { NextResponse } from "next/server";

/**
 * Flight number parser — Stage 3b
 *
 * Small inline lookup table. No external API calls in this stage;
 * stage 7 will add live flight status lookups.
 *
 * Heuristic: Israeli-registered carriers and most full-service airlines
 * use TLV Terminal 3. LCCs and charters use the renovated Terminal 1.
 */

interface Airline {
  name: string;
  // TLV terminal for this carrier (most departures/arrivals of Israeli trips are via TLV)
  terminal: "1" | "3";
}

// Airline code → metadata. Keys must be UPPERCASE.
const AIRLINES: Record<string, Airline> = {
  // Israeli full-service / legacy → Terminal 3
  LY: { name: "El Al", terminal: "3" },
  IZ: { name: "Arkia", terminal: "3" },
  "6H": { name: "Israir", terminal: "3" },

  // Full-service international → Terminal 3
  LH: { name: "Lufthansa", terminal: "3" },
  BA: { name: "British Airways", terminal: "3" },
  AF: { name: "Air France", terminal: "3" },
  KL: { name: "KLM", terminal: "3" },
  TK: { name: "Turkish Airlines", terminal: "3" },
  TP: { name: "TAP Portugal", terminal: "3" },
  AZ: { name: "ITA Airways", terminal: "3" },
  ITA: { name: "ITA Airways", terminal: "3" },
  OS: { name: "Austrian Airlines", terminal: "3" },
  LX: { name: "SWISS", terminal: "3" },
  IB: { name: "Iberia", terminal: "3" },
  AA: { name: "American Airlines", terminal: "3" },
  DL: { name: "Delta", terminal: "3" },
  UA: { name: "United", terminal: "3" },
  AC: { name: "Air Canada", terminal: "3" },
  LO: { name: "LOT Polish", terminal: "3" },
  OK: { name: "Czech Airlines", terminal: "3" },
  SN: { name: "Brussels Airlines", terminal: "3" },
  SK: { name: "SAS", terminal: "3" },
  AY: { name: "Finnair", terminal: "3" },

  // Low-cost carriers → Terminal 1
  W6: { name: "Wizz Air", terminal: "1" },
  FR: { name: "Ryanair", terminal: "1" },
  U2: { name: "easyJet", terminal: "1" },
  EZY: { name: "easyJet", terminal: "1" },
  H9: { name: "Himalaya / LCC", terminal: "1" },
  PC: { name: "Pegasus", terminal: "1" },
  VY: { name: "Vueling", terminal: "1" },
  DY: { name: "Norwegian", terminal: "1" },
  TO: { name: "Transavia France", terminal: "1" },
  HV: { name: "Transavia", terminal: "1" },
  EW: { name: "Eurowings", terminal: "1" },
};

/**
 * Extract airline code (2-3 chars) from a flight number string.
 * Accepts forms like "LY315", "LY 315", "EL AL 17", "W6 1234", "EZY2201".
 */
function extractAirlineCode(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;

  // Handle common full-name prefixes first.
  if (s.startsWith("EL AL")) return "LY";
  if (s.startsWith("WIZZ")) return "W6";
  if (s.startsWith("RYANAIR")) return "FR";
  if (s.startsWith("EASYJET")) return "U2";

  // Try 3-char IATA/ICAO-ish prefix (e.g. EZY2201, ITA123)
  const m3 = s.match(/^([A-Z]{3})\s*\d/);
  if (m3 && AIRLINES[m3[1]]) return m3[1];

  // Try 2-char/alphanumeric prefix (e.g. W6 1234, 6H 123, LY315)
  const m2 = s.match(/^([A-Z0-9]{2})\s*\d/);
  if (m2 && AIRLINES[m2[1]]) return m2[1];

  // Fallback: first two alphanumeric chars
  const alnum = s.replace(/[^A-Z0-9]/g, "");
  if (alnum.length >= 2) {
    const candidate = alnum.slice(0, 2);
    if (AIRLINES[candidate]) return candidate;
  }

  return null;
}

export async function POST(req: Request) {
  let body: { flightNumber?: string; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { airport: null, terminal: null, airline: null, error: "invalid JSON" },
      { status: 400 }
    );
  }

  const flightNumber = (body.flightNumber || "").trim();
  if (!flightNumber) {
    return NextResponse.json({ airport: null, terminal: null, airline: null });
  }

  const code = extractAirlineCode(flightNumber);
  if (!code) {
    // Unknown carrier — default to TLV T3 (most common) but flag airline unknown.
    return NextResponse.json({ airport: "TLV", terminal: "3", airline: null });
  }

  const airline = AIRLINES[code];
  return NextResponse.json({
    airport: "TLV",
    terminal: airline.terminal,
    airline: airline.name,
  });
}
