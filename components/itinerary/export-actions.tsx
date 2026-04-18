"use client";

import { Share2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { TimelineEvent } from "./timeline";
import { MEAL_TYPE_LABEL } from "@/lib/destinations";

export function ExportActions({
  events,
  dayTitle,
}: {
  events: TimelineEvent[];
  dayTitle: string;
}) {
  function buildWhatsAppText(): string {
    const lines = [`🗓️ ${dayTitle}`, ""];
    events.forEach((ev, i) => {
      const time = ev.time.slice(0, 5);
      if (ev.kind === "attraction") {
        const b = ev.booking;
        lines.push(`${i + 1}. 🕐 ${time} — ${b.name}`);
        if (b.waze_url) lines.push(`   🧭 ${b.waze_url}`);
      } else {
        const m = ev.meal;
        const label = MEAL_TYPE_LABEL[m.meal_type] ?? m.meal_type;
        lines.push(`${i + 1}. 🕐 ${time} — ${label}: ${m.name || "ארוחה"}`);
      }
    });
    lines.push("", "נשלח מ-TripMaster");
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildWhatsAppText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("הועתק ללוח — נפתח וואטסאפ");
    } catch {
      /* clipboard may fail on iOS without user gesture — ignore */
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--gold-700)] text-white text-sm font-medium hover:bg-[color:var(--gold-600)] transition"
      >
        <Share2 size={15} />
        שתף בוואטסאפ
      </button>
      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[color:var(--gold-500)]/30 text-[color:var(--gold-100)] text-sm font-medium hover:bg-[color:var(--gold-500)]/10 transition"
      >
        <Printer size={15} />
        הדפס
      </button>
    </div>
  );
}
