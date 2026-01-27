"use client";

import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markerPosition?: [number, number];
  popupText?: string;
}

const Map = ({
  center = [24.4539, 39.6142],
  zoom = 14,
  markerPosition,
  popupText = "PhysioGuidance",
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markerPos = markerPosition || center;

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstance) return;

    // Dynamically import Leaflet only on client side
    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // Create custom icon
      const customIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      // Initialize map
      const map = L.map(mapRef.current!, {
        center: center,
        zoom: zoom,
        scrollWheelZoom: false,
      });

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Add marker
      L.marker(markerPos, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupText);

      setMapInstance(map);
    };

    initMap();

    // Cleanup
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [center, zoom, markerPos, popupText]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-3xl"
      style={{ minHeight: "400px" }}
    />
  );
};

export default Map;
