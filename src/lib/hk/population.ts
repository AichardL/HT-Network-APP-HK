import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { HkArea } from "./skeleton";

// 香港真实人口图层：2021人口普查 LSG 聚合到 TPU(三级规划单元)，边界由规划署
// TPUSBVC_2021 转换。status=real。无人区(郊野/离岛) pop=0、populated=false。
// 数据来源：政府统计处 2021 人口普查 + 规划署 TPU 边界（EPSG:2326->WGS84）。
import rawTpuGeo from "./tpu-population.json";

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

export const TPU_POPULATION_SOURCE = {
  status: "real" as const,
  actualSource: "2021 Population Census (C&SD) + TPU boundaries (Planning Department)",
  sourceDate: "2021",
  note: "TPU级真实人口：由2021人口普查LSG聚合到三级规划单元(TPU)，边界经HK80->WGS84转换。无人区(郊野/离岛)人口为0。",
};

export const HK_TPU_LAYER = rawTpuGeo as unknown as {
  type: "FeatureCollection";
  features: HkTpuFeature[];
};

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

// 给商圈关联最近 TPU 人口（用于商圈面板展示真实人口参考）。
export function areaPopulation(a: HkArea): HkTpuFeature["properties"] | null {
  return findTpu(a.center.lat, a.center.lng);
}