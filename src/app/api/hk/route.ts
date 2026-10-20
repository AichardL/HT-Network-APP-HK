import { json } from "@/lib/hk-api";
import { HK_DISTRICTS, HK_PLANNING_UNITS } from "@/lib/hk/districts";
import { HK_TPU_LAYER, TPU_POPULATION_SOURCE, totalPopulation } from "@/lib/hk/population";
import { HK_TRANSIT } from "@/lib/hk/transit";
import { HK_MARKET_SOURCE } from "@/lib/hk/skeleton";
import manifest from "@/lib/hk/manifest.json";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  const total = totalPopulation();
  return json({
    market: "HK",
    marker: HK_MARKET_SOURCE,
    center: { lat: 22.3193, lng: 114.1694 },
    navigation: {
      districts: HK_DISTRICTS,
      planningUnits: HK_PLANNING_UNITS,
      population: {
        source: TPU_POPULATION_SOURCE,
        summary: { total: total.pop, young: total.young, tpuCount: total.tpus },
        layer: HK_TPU_LAYER,
      },
    },
    transit: HK_TRANSIT,
    sources: manifest,
    phase: {
      browse: true,
      lightPick: true,
      analyzing: false,
      note: "Phase 1 只支持地图浏览和可解释点选；不执行 Trade Area、评分、候选比较或客流推断。",
    },
  });
}
