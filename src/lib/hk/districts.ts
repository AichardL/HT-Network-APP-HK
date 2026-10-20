import rawDistricts from "./districts.json";
import rawPlanningUnits from "./planning-units.json";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { SourceMeta } from "./provenance";

export type BoundaryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type HkBoundaryFeature = {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    en: string;
    level: "district" | "ppu" | "spu" | "tpu";
    population: number | null;
    period: string;
  };
  geometry: BoundaryGeometry;
};

export type HkBoundaryLayer = {
  source: SourceMeta;
  features: HkBoundaryFeature[];
};

export const HK_DISTRICTS = rawDistricts as HkBoundaryLayer;
export const HK_PLANNING_UNITS = rawPlanningUnits as HkBoundaryLayer;

export const districtSource = HK_DISTRICTS.source;
export const planningUnitSource = HK_PLANNING_UNITS.source;

export function allBoundaryFeatures(): HkBoundaryFeature[] {
  return [...HK_DISTRICTS.features, ...HK_PLANNING_UNITS.features];
}

export function findBoundary(lat: number, lng: number, level: HkBoundaryFeature["properties"]["level"]): HkBoundaryFeature["properties"] | null {
  for (const feature of allBoundaryFeatures()) {
    if (feature.properties.level !== level) continue;
    if (booleanPointInPolygon([lng, lat], feature.geometry as never)) return feature.properties;
  }
  return null;
}
