"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  order: number;
}

export function DayMap({
  pins,
  activeId,
  onPinClick,
  className,
}: {
  pins: MapPin[];
  activeId?: string | null;
  onPinClick?: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const hasPins = pins.length > 0;
    const center: [number, number] = hasPins
      ? [pins[0].lng, pins[0].lat]
      : [34.7818, 32.0853]; // Tel Aviv fallback

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center,
      zoom: hasPins ? 12 : 6,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      if (pins.length >= 2) {
        const coords = pins.map((p) => [p.lng, p.lat] as [number, number]);
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#B08B3F",
            "line-width": 3,
            "line-dasharray": [2, 2],
            "line-opacity": 0.8,
          },
        });
      }

      // Fit bounds to all pins
      if (pins.length >= 2) {
        const bounds = new maplibregl.LngLatBounds();
        pins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers whenever pins change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    pins.forEach((pin) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", pin.label);
      el.style.cssText = `
        width:36px;height:36px;border-radius:50%;
        background:${pin.color};border:3px solid #fff;
        box-shadow:0 4px 12px rgba(0,0,0,0.35);
        cursor:pointer;display:grid;place-items:center;
        color:#fff;font-family:Rubik,sans-serif;font-weight:600;font-size:13px;
        transition:transform 0.2s ease;
      `;
      el.textContent = String(pin.order);
      el.onmouseenter = () => (el.style.transform = "scale(1.15)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");
      if (onPinClick) el.onclick = () => onPinClick(pin.id);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      markersRef.current[pin.id] = marker;
    });
  }, [pins, onPinClick]);

  // Pulse active marker + flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeId) return;
    const pin = pins.find((p) => p.id === activeId);
    if (!pin) return;
    map.flyTo({ center: [pin.lng, pin.lat], zoom: 15, duration: 900, essential: true });
    const marker = markersRef.current[activeId];
    if (marker) {
      const el = marker.getElement();
      el.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35)" },
          { transform: "scale(1)" },
        ],
        { duration: 600, easing: "ease-out" }
      );
    }
  }, [activeId, pins]);

  return <div ref={containerRef} className={className} />;
}
