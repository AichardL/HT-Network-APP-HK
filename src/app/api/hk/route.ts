import { json } from "@/lib/hk-api";
import {
  HK_AREAS,
  HK_LINES,
  HK_MARKET_SOURCE,
} from "@/lib/hk/skeleton";
import {
  HK_TPU_LAYER,
  TPU_POPULATION_SOURCE,
  totalPopulation,
} from "@/lib/hk/population";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 香港布局：商圈示意 + 港铁线路主干站点 + 真实 TPU 级别人口图层。
// 商圈/港铁坐标仍为占位示意；人口为 2021 人口普查真实数据（TPU 级）。
export function GET() {
  const tot = totalPopulation();
  return json({
    market: "HK",
    marker: HK_MARKET_SOURCE,
    areas: HK_AREAS,
    lines: HK_LINES,
    center: { lat: 22.3193, lng: 114.1694 },
    population: {
      source: TPU_POPULATION_SOURCE,
      summary: {
        total: tot.pop,
        young: tot.young,
        tpuCount: tot.tpus,
      },
      layer: HK_TPU_LAYER,
    },
  });
}