import { json } from "@/lib/hk-api";
import { findBoundary } from "@/lib/hk/districts";
import { findPlanning, findTpu, TPU_POPULATION_SOURCE } from "@/lib/hk/population";
import { nearestStation } from "@/lib/hk/transit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INPUT_RE = /^(-?\d+(\.\d+)?)$/;

export function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const latRaw = query.get("lat") ?? "";
  const lngRaw = query.get("lng") ?? "";
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!INPUT_RE.test(latRaw) || !INPUT_RE.test(lngRaw) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "缺少合法 lat / lng" }, 400);
  }
  if (lat < 22.1 || lat > 22.6 || lng < 113.8 || lng > 114.5) {
    return json({ error: "坐标不在香港首期地图范围内" }, 422);
  }

  const district = findBoundary(lat, lng, "district");
  const ppu = findPlanning(lat, lng, "ppu");
  const spu = findPlanning(lat, lng, "spu");
  const tpu = findTpu(lat, lng);
  const station = nearestStation(lat, lng);

  return json({
    point: { lat, lng },
    hierarchy: {
      district,
      ppu,
      spu,
      tpu: tpu ? { id: String(tpu.tpu), name: `TPU ${tpu.tpu}`, level: "tpu", population: tpu.pop, period: "2021 Population Census" } : null,
    },
    population: {
      estimate: tpu?.pop ?? null,
      young: tpu?.young ?? null,
      households: tpu?.households ?? null,
      source: TPU_POPULATION_SOURCE,
      note: "人口为2021年常住人口统计，不代表实时到访人口。",
    },
    nearestStation: station,
    sources: [
      district ? { provider: "CSDI / Census and Statistics Department", status: "real", note: "2021区议会区边界快照" } : { provider: "CSDI / Census and Statistics Department", status: "unavailable", note: "点位未落入本地区界快照" },
      ppu || spu ? { provider: "CSDI / Planning Department", status: "real", note: "PPU/SPU边界快照" } : { provider: "CSDI / Planning Department", status: "unavailable", note: "点位未落入本地规划单元快照" },
      { provider: "C&SD / Planning Department", status: "real", note: "TPU人口快照；不代表实时到访人口" },
    ],
    phase: { mode: "light-pick", analysisEnabled: false, note: "Phase 1 不产生 Trade Area、评分、客流或选址结论。" },
  });
}
