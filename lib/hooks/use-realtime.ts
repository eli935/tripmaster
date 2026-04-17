"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
// Raw realtime payloads are typed as `unknown` here — the Supabase generic
// payload types require `{ [key: string]: any }` which conflicts with the
// domain row types we'd like to pass in. The `row` argument to each callback
// is fully typed; consumers rarely need the raw payload.

/**
 * Subscribe to realtime changes on trip-related tables.
 * Triggers a router.refresh() whenever data changes.
 *
 * Covers the full set of trip-scoped tables now that migration 009
 * has added expenses/expense_splits/expense_payers/trip_messages/trip_files
 * to the supabase_realtime publication.
 */
export function useRealtimeTrip(tripId: string) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const refresh = () => router.refresh();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`trip-${tripId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_participants", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_equipment", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expense_splits" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expense_payers" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_files", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "meal_items" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "meal_attendance" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_todos", filter: `trip_id=eq.${tripId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_recommendations", filter: `trip_id=eq.${tripId}` }, refresh)
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`[realtime] trip channel status: ${status} (publication may be missing for some tables)`);
          }
        });
    } catch (err) {
      console.warn("[realtime] failed to subscribe to trip channel:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* noop */
        }
      }
    };
  }, [tripId, router, supabase]);
}

// ---------------------------------------------------------------------------
// useRealtimeTable — generic typed subscription with per-event callbacks
// ---------------------------------------------------------------------------

export interface UseRealtimeTableOptions<T> {
  /** Postgres filter expression, e.g. "trip_id=eq.<uuid>". Omit for no filter. */
  filter?: string;
  /** Fire on INSERT events only. */
  onInsert?: (row: T, payload: unknown) => void;
  /** Fire on UPDATE events only. */
  onUpdate?: (row: T, payload: unknown) => void;
  /** Fire on DELETE events only. Row is the old row snapshot. */
  onDelete?: (row: Partial<T>, payload: unknown) => void;
  /** Fire on any event. Receives raw payload. */
  onAny?: (payload: unknown) => void;
  /** Disable the subscription entirely. Default: true (enabled). */
  enabled?: boolean;
  /** Optional custom channel name. Defaults to `${table}-${filter || 'all'}`. */
  channelName?: string;
}

/**
 * Subscribe to realtime changes on a single Postgres table.
 *
 * Gracefully handles tables that aren't in the supabase_realtime publication:
 * a console.warn is emitted and the component continues to function.
 */
export function useRealtimeTable<T = Record<string, unknown>>(
  table: string,
  tripId: string | undefined,
  options: UseRealtimeTableOptions<T> = {}
) {
  const supabase = createClient();

  // Keep latest callbacks in refs so effect doesn't re-subscribe on every render
  const optsRef = useRef(options);
  optsRef.current = options;

  const { filter, enabled = true, channelName } = options;

  useEffect(() => {
    if (!enabled) return;

    const effectiveFilter = filter ?? (tripId ? `trip_id=eq.${tripId}` : undefined);
    const name = channelName ?? `rt-${table}-${effectiveFilter ?? "all"}`;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase.channel(name);

      const baseCfg = {
        event: "*" as const,
        schema: "public",
        table,
        ...(effectiveFilter ? { filter: effectiveFilter } : {}),
      };

      channel = channel.on("postgres_changes", baseCfg, (payload: unknown) => {
        const p = payload as {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: T;
          old: Partial<T>;
        };
        const cb = optsRef.current;
        try {
          cb.onAny?.(payload);
          if (p.eventType === "INSERT") {
            cb.onInsert?.(p.new, payload);
          } else if (p.eventType === "UPDATE") {
            cb.onUpdate?.(p.new, payload);
          } else if (p.eventType === "DELETE") {
            cb.onDelete?.(p.old, payload);
          }
        } catch (err) {
          console.error(`[realtime] handler error for ${table}:`, err);
        }
      });

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[realtime] '${table}' channel status: ${status}. ` +
              `If this is unexpected, verify the table is in the supabase_realtime publication.`
          );
        }
      });
    } catch (err) {
      console.warn(`[realtime] failed to subscribe to '${table}':`, err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* noop */
        }
      }
    };
  }, [table, tripId, filter, enabled, channelName, supabase]);
}
