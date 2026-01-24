"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon
const customIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markerPosition?: [number, number];
  popupText?: string;
}

const Map = ({
  center = [24.4539, 39.6142], // Default to Medina, Saudi Arabia
  zoom = 14,
  markerPosition,
  popupText = "PhysioGuidance",
}: MapProps) => {
  const markerPos = markerPosition || center;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      className="rounded-3xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={markerPos} icon={customIcon}>
        <Popup>{popupText}</Popup>
      </Marker>
    </MapContainer>
  );
};

export default Map;
