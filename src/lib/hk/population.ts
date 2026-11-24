import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { SourceMeta } from "./provenance";
import { findBoundary, HK_DISTRICTS, type HkBoundaryFeature } from "./districts";
import type { Coordinate } from "../geo";

// 香港真实人口图层：2021人口普查 LSG 聚合到 TPU(三级规划单元)，边界由规划署
// TPUSBVC_2021 转换。status=real。无人区(郊野/离岛) pop=0、populated=false。
// 数据来源：政府统计处 2021 人口普查 + 规划署 TPU 边界（EPSG:2326->WGS84）。
import rawTpuGeo from "./tpu-population.json";
import rawPlanningLookup from "./planning-lookup.json";
import rawMheGeo from "./mhe-population.json";
import rawStpug from "./stpug-population.json";
import rawSsug from "./ssug-population.json";

export type HkTpuGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type HkTpuFeature = {
  type: "Feature";
  properties: {
    tpu: number;
    pop: number;
    young: number;
    households: number;
    incomeAvg: number | null;
    populated: boolean;
  };
  geometry: HkTpuGeometry;
};

export const TPU_POPULATION_SOURCE: SourceMeta = {
  status: "real" as const,
  provider: "Census and Statistics Department / Planning Department",
  actualSource: "2021 Population Census (C&SD) + TPU boundaries (Planning Department)",
  period: "2021 Population Census",
  retrievedAt: "see snapshot manifest",
  note: "TPU级真实人口：由2021人口普查LSG聚合到三级规划单元(TPU)，边界经HK80->WGS84转换。无人区(郊野/离岛)人口为0。",
};

export const STPUG_POPULATION_SOURCE: SourceMeta = {
  status: "real" as const,
  provider: "Census and Statistics Department / CSDI",
  actualSource: "https://portal.csdi.gov.hk/csdi-webpage/dataset/censtatd_rcd_1635933193720_58660",
  period: "2021 Population Census",
  retrievedAt: "see snapshot manifest",
  note: "211 个 STPUG 小规划统计区小合并组；年龄 × 性别字段来自 Census 2021 IDDS，不能拆分回 292 个 TPU。",
};

export const SSUG_POPULATION_SOURCE: SourceMeta = {
  status: "real" as const,
  provider: "Census and Statistics Department / CSDI",
  actualSource: "https://portal.csdi.gov.hk/csdi-webpage/dataset/censtatd_rcd_1635933365202_19171",
  period: "2021 Population Census",
  retrievedAt: "see snapshot manifest",
  note: "2,342 个单元区小合并组（Small Subunit Group）；人口为 2021 年常住人口。",
};

export const HK_TPU_LAYER = rawTpuGeo as unknown as {
  type: "FeatureCollection";
  features: HkTpuFeature[];
};

type PlanningLookup = { tpu: number; spu: number; ppu: number; spuPopulation: number; ppuPopulation: number };
const PLANNING_LOOKUP = rawPlanningLookup.items as PlanningLookup[];
type AgeBand = "0-14" | "15-24" | "25-44" | "45-64" | "65+";
const AGE_BANDS: AgeBand[] = ["0-14", "15-24", "25-44", "45-64", "65+"];
type StpugProfile = {
  code: string;
  name: string;
  en: string;
  population: number;
  male: number;
  female: number;
  age: Record<AgeBand, number>;
  ageSex: { male: Record<AgeBand, number>; female: Record<AgeBand, number> };
  representativePoint: Coordinate;
  tpuCodes: number[];
};
const STPUG_PROFILES = rawStpug.features as StpugProfile[];
const STPUG_BY_CODE = new Map(STPUG_PROFILES.map((profile) => [profile.code, profile]));
const TPU_TO_STPUG = rawStpug.tpuToStpug as Record<string, string>;

export type HkPopulationLevel = "district" | "ppu" | "spu" | "tpu" | "mhe";
export type HkMapPopulationLevel = HkPopulationLevel | "ssug";
export type HkPopulationLayer = { source: SourceMeta; features: HkBoundaryFeature[] };

const TPU_BY_ID = new Map(HK_TPU_LAYER.features.map((feature) => [feature.properties.tpu, feature]));
const LOOKUP_BY_TPU = new Map(PLANNING_LOOKUP.map((item) => [item.tpu, item]));

const DERIVED_PLANNING_SOURCE: SourceMeta = {
  status: "real",
  provider: "CSDI / Planning Department + C&SD",
  actualSource: "TPUSU_2021 boundaries + planning-lookup.json + 2021 Population Census",
  period: "2021 Population Census",
  retrievedAt: "see snapshot manifest",
  note: "PPU / SPU 边界由官方 TPU 边界按 CSDI 层级关系聚合生成；人口为所属 TPU 人口之和。",
};

function combineTpuGeometry(tpus: HkTpuFeature[]): HkBoundaryFeature["geometry"] {
  const polygons = tpus.flatMap((feature) =>
    feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates,
  );
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

function aggregatePlanningLevel(level: "ppu" | "spu"): HkPopulationLayer {
  const groups = new Map<number, HkTpuFeature[]>();
  for (const item of PLANNING_LOOKUP) {
    const tpu = TPU_BY_ID.get(item.tpu);
    if (!tpu) continue;
    const id = item[level];
    const group = groups.get(id) ?? [];
    group.push(tpu);
    groups.set(id, group);
  }

  const features = [...groups.entries()].sort(([a], [b]) => a - b).map(([id, tpus]) => ({
    type: "Feature" as const,
    properties: {
      id: `${level}-${id}`,
      name: `${level.toUpperCase()} ${id}`,
      en: `${level.toUpperCase()} ${id}`,
      level,
      population: tpus.reduce((sum, tpu) => sum + tpu.properties.pop, 0),
      period: "2021 Population Census",
    },
    geometry: combineTpuGeometry(tpus),
  }));
  return { source: DERIVED_PLANNING_SOURCE, features };
}

const TPU_BOUNDARY_LAYER: HkPopulationLayer = {
  source: TPU_POPULATION_SOURCE,
  features: HK_TPU_LAYER.features.map((feature) => ({
    type: "Feature" as const,
    properties: {
      id: `tpu-${feature.properties.tpu}`,
      name: `TPU ${feature.properties.tpu}`,
      en: `TPU ${feature.properties.tpu}`,
      level: "tpu" as const,
      population: feature.properties.pop,
      period: "2021 Population Census",
    },
    geometry: feature.geometry,
  })),
};

const MHE_POPULATION_SOURCE: SourceMeta = {
  status: "real",
  provider: "Census and Statistics Department / CSDI",
  actualSource: "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1695182015782_79001&format=geojson&layer_name=MHE_21C",
  period: "2021 Population Census",
  retrievedAt: "2026-10-28",
  note: "540 个主要屋苑统计及边界；屋苑人口是 2021 年常住人口。",
};

const MHE_POPULATION_LAYER: HkPopulationLayer = {
  source: MHE_POPULATION_SOURCE,
  features: (rawMheGeo as unknown as { features: { properties: { estate: number; estate_chi: string; estate_eng: string; t_pop: number | string }; geometry: HkBoundaryFeature["geometry"] }[] }).features.map((feature) => ({
    type: "Feature" as const,
    properties: {
      id: `mhe-${feature.properties.estate}`,
      name: feature.properties.estate_chi,
      en: feature.properties.estate_eng,
      level: "mhe" as const,
      population: Number(feature.properties.t_pop) || 0,
      period: "2021 Population Census",
    },
    geometry: feature.geometry,
  })),
};

type SsugFeature = {
  type: "Feature";
  properties: {
    id: string;
    code: string;
    name: string;
    en: string;
    level: "ssug";
    population: number;
    parentTpu: number | null;
    period: string;
  };
  geometry: HkBoundaryFeature["geometry"];
  representativePoint: Coordinate;
};

const SSUG_LAYER = rawSsug as unknown as { source: SourceMeta; features: SsugFeature[] };
const SSUG_POPULATION_LAYER: HkPopulationLayer = {
  source: SSUG_POPULATION_SOURCE,
  features: SSUG_LAYER.features.map((feature) => ({ type: feature.type, properties: feature.properties, geometry: feature.geometry })),
};

export const HK_POPULATION_LAYERS: Record<HkMapPopulationLevel, HkPopulationLayer> = {
  district: HK_DISTRICTS,
  ppu: aggregatePlanningLevel("ppu"),
  spu: aggregatePlanningLevel("spu"),
  tpu: TPU_BOUNDARY_LAYER,
  mhe: MHE_POPULATION_LAYER,
  ssug: SSUG_POPULATION_LAYER,
};

export type NearbyPopulation = {
  radiusKm: number;
  total: number;
  tpuCount: number;
  includedTpuCodes: string[];
  subunitTotal: number;
  ssugCount: number;
  includedSsugCodes: string[];
  breakdown: Record<HkMapPopulationLevel, { id: string; name: string; population: number }[]>;
  demographicProfile: PopulationProfile;
  note: string;
};

export type PopulationProfile = {
  total: number;
  male: number;
  female: number;
  female15to24: number;
  female15to44: number;
  ageBreakdown: { band: AgeBand; male: number; female: number; total: number }[];
  includedStpugCodes: string[];
  units: { code: string; name: string; population: number; male: number; female: number; female15to24: number; female15to44: number }[];
  note: string;
};

const representativePoint = new Map<number, Coordinate>();

function representativePointOf(feature: HkTpuFeature): Coordinate {
  const cached = representativePoint.get(feature.properties.tpu);
  if (cached) return cached;
  const rings = feature.geometry.type === "Polygon"
    ? feature.geometry.coordinates
    : feature.geometry.coordinates.flat();
  let lat = 0;
  let lng = 0;
  let count = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      lng += x;
      lat += y;
      count += 1;
    }
  }
  const point = { lat: lat / count, lng: lng / count };
  representativePoint.set(feature.properties.tpu, point);
  return point;
}

function distanceKm(a: Coordinate, b: Coordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function addToBreakdown(
  target: Map<string, { id: string; name: string; population: number }>,
  id: string,
  name: string,
  population: number,
) {
  const current = target.get(id);
  if (current) current.population += population;
  else target.set(id, { id, name, population });
}

function sumAgeBands(values: Record<AgeBand, number>, bands: AgeBand[]) {
  return bands.reduce((sum, band) => sum + (values[band] ?? 0), 0);
}

function buildDemographicProfile(lat: number, lng: number, radius: number): PopulationProfile {
  const point = { lat, lng };
  const selectedCodes = new Set<string>();
  const pointTpu = findTpu(lat, lng);
  const pointStpug = pointTpu ? TPU_TO_STPUG[String(pointTpu.tpu)] : undefined;
  for (const profile of STPUG_PROFILES) {
    if (profile.code === pointStpug || distanceKm(point, profile.representativePoint) <= radius) selectedCodes.add(profile.code);
  }

  const selected = [...selectedCodes].map((code) => STPUG_BY_CODE.get(code)).filter((profile): profile is StpugProfile => Boolean(profile));
  const ageBreakdown = AGE_BANDS.map((band) => {
    const male = selected.reduce((sum, profile) => sum + profile.ageSex.male[band], 0);
    const female = selected.reduce((sum, profile) => sum + profile.ageSex.female[band], 0);
    return { band, male, female, total: male + female };
  });
  const units = selected.map((profile) => ({
    code: profile.code,
    name: profile.name,
    population: profile.population,
    male: profile.male,
    female: profile.female,
    female15to24: profile.ageSex.female["15-24"],
    female15to44: sumAgeBands(profile.ageSex.female, ["15-24", "25-44"]),
  })).sort((a, b) => b.population - a.population);
  return {
    total: selected.reduce((sum, profile) => sum + profile.population, 0),
    male: selected.reduce((sum, profile) => sum + profile.male, 0),
    female: selected.reduce((sum, profile) => sum + profile.female, 0),
    female15to24: ageBreakdown.find((row) => row.band === "15-24")?.female ?? 0,
    female15to44: (ageBreakdown.find((row) => row.band === "15-24")?.female ?? 0) + (ageBreakdown.find((row) => row.band === "25-44")?.female ?? 0),
    ageBreakdown,
    includedStpugCodes: selected.map((profile) => profile.code).sort(),
    units,
    note: "年龄 × 性别人口来自 2021 人口普查官方 STPUG 小合并组。该统计层级按官方发布单元整组汇总，不能拆分回 292 个 TPU；画像人口与 TPU 覆盖人口可能存在口径差异。",
  };
}

export function nearbyPopulation(lat: number, lng: number, radiusKm: number): NearbyPopulation {
  const point = { lat, lng };
  const radius = Math.min(Math.max(radiusKm, 0.25), 10);
  const matches = HK_TPU_LAYER.features.filter((feature) => {
    if (!feature.properties.populated || feature.properties.pop <= 0) return false;
    const inside = booleanPointInPolygon([lng, lat], feature.geometry as never);
    return inside || distanceKm(point, representativePointOf(feature)) <= radius;
  });
  const subunitMatches = SSUG_LAYER.features.filter((feature) => {
    if (feature.properties.population <= 0) return false;
    const inside = booleanPointInPolygon([lng, lat], feature.geometry as never);
    return inside || distanceKm(point, feature.representativePoint) <= radius;
  });
  const breakdownMaps: Record<HkMapPopulationLevel, Map<string, { id: string; name: string; population: number }>> = {
    district: new Map(),
    ppu: new Map(),
    spu: new Map(),
    tpu: new Map(),
    mhe: new Map(),
    ssug: new Map(),
  };

  for (const feature of matches) {
    const item = LOOKUP_BY_TPU.get(feature.properties.tpu);
    const tpu = HK_POPULATION_LAYERS.tpu.features.find((candidate) => candidate.properties.id === `tpu-${feature.properties.tpu}`);
    const district = findBoundary(representativePointOf(feature).lat, representativePointOf(feature).lng, "district");
    if (district) addToBreakdown(breakdownMaps.district, district.id, district.name, feature.properties.pop);
    if (item) {
      addToBreakdown(breakdownMaps.ppu, `ppu-${item.ppu}`, `PPU ${item.ppu}`, feature.properties.pop);
      addToBreakdown(breakdownMaps.spu, `spu-${item.spu}`, `SPU ${item.spu}`, feature.properties.pop);
    }
    if (tpu) addToBreakdown(breakdownMaps.tpu, tpu.properties.id, tpu.properties.name, feature.properties.pop);
  }

  for (const feature of MHE_POPULATION_LAYER.features) {
    const inside = booleanPointInPolygon([lng, lat], feature.geometry as never);
    const center = representativePointOfGeometry(feature.geometry);
    if (inside || distanceKm(point, center) <= radius) {
      addToBreakdown(breakdownMaps.mhe, feature.properties.id, feature.properties.name, feature.properties.population ?? 0);
    }
  }

  for (const feature of subunitMatches) {
    addToBreakdown(breakdownMaps.ssug, feature.properties.id, feature.properties.name, feature.properties.population);
  }

  const breakdown = Object.fromEntries(Object.entries(breakdownMaps).map(([level, values]) => [
    level,
    [...values.values()].sort((a, b) => b.population - a.population),
  ])) as NearbyPopulation["breakdown"];
  return {
    radiusKm: radius,
    total: matches.reduce((sum, feature) => sum + feature.properties.pop, 0),
    tpuCount: matches.length,
    includedTpuCodes: matches.map((feature) => feature.properties.tpu).sort((a, b) => a - b).map(String),
    subunitTotal: subunitMatches.reduce((sum, feature) => sum + feature.properties.population, 0),
    ssugCount: subunitMatches.length,
    includedSsugCodes: subunitMatches.map((feature) => feature.properties.code).sort(),
    breakdown,
    demographicProfile: buildDemographicProfile(lat, lng, radius),
    note: "数字名称为“周边 TPU 覆盖人口近似值”。按 2021 年常住人口统计；所在 TPU 直接计入，其他 TPU 按代表点落入半径计入，不代表圆形范围内的精确人口，也不代表实时到访人口。",
  };
}

function representativePointOfGeometry(geometry: HkBoundaryFeature["geometry"]): Coordinate {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let lat = 0;
  let lng = 0;
  let count = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        lng += x;
        lat += y;
        count += 1;
      }
    }
  }
  return { lat: lat / count, lng: lng / count };
}

export function totalPopulation(): { pop: number; young: number; tpus: number } {
  let pop = 0;
  let young = 0;
  let tpus = 0;
  for (const f of HK_TPU_LAYER.features) {
    if (!f.properties.populated) continue;
    pop += f.properties.pop;
    young += f.properties.young;
    tpus += 1;
  }
  return { pop, young, tpus };
}
// 找出 (lat,lng) 落在哪个 TPU；找不到返回 null（如离岛/水上/郊野无人口区）。
export function findTpu(lat: number, lng: number): HkTpuFeature["properties"] | null {
  for (const f of HK_TPU_LAYER.features) {
    // fast reject via bbox
    const b = boundsOf(f.geometry);
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    if (
      booleanPointInPolygon(
        [lng, lat],
        f.geometry as unknown as Parameters<typeof booleanPointInPolygon>[1],
      )
    ) {
      return f.properties;
    }
  }
  return null;
}

export function findSsug(lat: number, lng: number): SsugFeature["properties"] | null {
  for (const feature of SSUG_LAYER.features) {
    const bounds = boundsOf(feature.geometry);
    if (lng < bounds[0] || lng > bounds[2] || lat < bounds[1] || lat > bounds[3]) continue;
    if (booleanPointInPolygon([lng, lat], feature.geometry as never)) return feature.properties;
  }
  return null;
}

export function findPlanning(lat: number, lng: number, level: "ppu" | "spu") {
  const tpu = findTpu(lat, lng);
  if (!tpu) return null;
  const item = PLANNING_LOOKUP.find((candidate) => candidate.tpu === tpu.tpu);
  if (!item) return null;
  const id = level === "ppu" ? item.ppu : item.spu;
  return {
    id: String(id),
    name: `${level.toUpperCase()} ${id}`,
    en: `${level.toUpperCase()} ${id}`,
    level,
    population: level === "ppu" ? item.ppuPopulation : item.spuPopulation,
    period: "2021 Population Census",
  } as const;
}

function boundsOf(geo: HkTpuFeature["geometry"]): [number, number, number, number] {
  const rings =
    geo.type === "Polygon"
      ? (geo.coordinates as number[][][])
      : (geo.coordinates as number[][][][]).flat();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of rings) {
    for (const pt of ring) {
      const x = pt[0];
      const y = pt[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}
