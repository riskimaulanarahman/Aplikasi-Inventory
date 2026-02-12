"use client";

import { useEffect, useRef } from "react";

interface OutletMapPickerProps {
  latitude: number;
  longitude: number;
  onChange: (next: { latitude: number; longitude: number }) => void;
}

declare global {
  interface Window {
    L?: any;
    __outletMapLeafletLoading?: Promise<void>;
  }
}

async function ensureLeafletLoaded() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.L) {
    return;
  }

  if (!window.__outletMapLeafletLoading) {
    window.__outletMapLeafletLoading = new Promise<void>((resolve, reject) => {
      const hasCss = document.querySelector('link[data-leaflet=\"1\"]');
      if (!hasCss) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        stylesheet.setAttribute("data-leaflet", "1");
        document.head.appendChild(stylesheet);
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat Leaflet."));
      document.body.appendChild(script);
    });
  }

  return window.__outletMapLeafletLoading;
}

export default function OutletMapPicker({ latitude, longitude, onChange }: OutletMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function setupMap() {
      await ensureLeafletLoaded();
      if (cancelled || !containerRef.current || !window.L) {
        return;
      }

      if (!mapRef.current) {
        const map = window.L.map(containerRef.current).setView([latitude, longitude], 13);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>'
        }).addTo(map);

        const marker = window.L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#0ea5e9",
          fillColor: "#0ea5e9",
          fillOpacity: 0.9,
          weight: 2
        }).addTo(map);

        map.on("click", (event: any) => {
          const nextLatitude = event.latlng.lat;
          const nextLongitude = event.latlng.lng;
          marker.setLatLng([nextLatitude, nextLongitude]);
          onChange({
            latitude: nextLatitude,
            longitude: nextLongitude
          });
        });

        let isDragging = false;

        marker.on("mousedown", () => {
          isDragging = true;
        });

        map.on("mousemove", (event: any) => {
          if (!isDragging) {
            return;
          }

          marker.setLatLng(event.latlng);
        });

        map.on("mouseup", (event: any) => {
          if (!isDragging) {
            return;
          }

          isDragging = false;
          const nextLatitude = event.latlng.lat;
          const nextLongitude = event.latlng.lng;

          marker.setLatLng([nextLatitude, nextLongitude]);
          onChange({
            latitude: nextLatitude,
            longitude: nextLongitude
          });
        });

        mapRef.current = map;
        markerRef.current = marker;
      } else {
        mapRef.current.setView([latitude, longitude], mapRef.current.getZoom(), {
          animate: false
        });
        markerRef.current?.setLatLng([latitude, longitude]);
      }
    }

    setupMap().catch(() => {
      // fallback handled by static box below
    });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, onChange]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-0 h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
    />
  );
}
