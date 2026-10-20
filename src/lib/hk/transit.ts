import rawTransit from "./transit.json";
import type { SourceMeta } from "./provenance";

export type HkTransitMode = "heavy" | "light";

export type HkStation = {
  id: string;
  code: string;
  name: string;
  en: string;
  lat: number;
  lng: number;
  mode: HkTransitMode;
};

export type HkLine = {
  id: string;
  code: string;
  name: string;
  en: string;
  color: string;
  mode: HkTransitMode;
  stations: HkStation[];
};

export type HkTransitSnapshot = {
  heavy: { source: SourceMeta; lines: HkLine[]; stations: HkStation[] };
  light: { source: SourceMeta; lines: HkLine[]; stations: HkStation[] };
};

export const HK_TRANSIT = rawTransit as HkTransitSnapshot;
export const HK_LINES = [...HK_TRANSIT.heavy.lines, ...HK_TRANSIT.light.lines];
export const HK_STATIONS = [...HK_TRANSIT.heavy.stations, ...HK_TRANSIT.light.stations];

export function nearestStation(lat: number, lng: number): (HkStation & { distanceKm: number }) | null {
  let nearest: (HkStation & { distanceKm: number }) | null = null;
  for (const station of HK_STATIONS) {
    const distanceKm = haversineKm(lat, lng, station.lat, station.lng);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { ...station, distanceKm };
    }
  }
  return nearest;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = Math.PI / 180;
  const dLat = (lat2 - lat1) * radians;
  const dLng = (lng2 - lng1) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
