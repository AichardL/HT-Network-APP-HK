import { json } from "@/lib/hk-api";
import { HK_AREAS, HK_MARKET_SOURCE } from "@/lib/hk/skeleton";
import { findTpu, TPU_POPULATION_SOURCE } from "@/lib/hk/population";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INPUT_RE = /^(-?\d+(\.\d+)?)$/;

// 香港点位分析：商圈示意 + 点所在 TPU 的真实人口（2021人口普查）。
// 客流/竞品仍为占位 null 并标注「待接入」。radius 仅支持 0.5/1/1.5km。
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat") ?? NaN);
  const lng = Number(q.get("lng") ?? NaN);
  const radius = Number(q.get("radius") ?? 1);
  if (
    !INPUT_RE.test(q.get("lat") ?? "") ||
    !INPUT_RE.test(q.get("lng") ?? "") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  )
    return json({ error: "缺少合法 lat / lng" }, 400);
  if (![0.5, 1, 1.5].includes(radius))
    return json({ error: "radius 仅支持 0.5 / 1 / 1.5 km" }, 400);

  const areasWithin = HK_AREAS.filter((a) => {
    const dLat = (lat - a.center.lat) * 111;
    const dLng = (lng - a.center.lng) * 111 * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng) <= a.radiusKm;
  }).map((a) => ({ id: a.id, name: a.name, en: a.en, type: a.type }));

  const tpu = findTpu(lat, lng);

  return json({
    point: { lat, lng },
    radiusKm: radius,
    marker: HK_MARKET_SOURCE,
    areasWithin,
    // 真实人口：点落在哪个 TPU 就用该 TPU 的 2021 普查人口；不在任何 TPU（水上/郊野无人口区）则为 null。
    population: {
      estimate: tpu ? tpu.pop : null,
      density: null,
      young: tpu ? tpu.young : null,
      households: tpu ? tpu.households : null,
      tpu: tpu ? tpu.tpu : null,
      source: TPU_POPULATION_SOURCE,
      method: tpu
        ? "2021人口普查LSG聚合到所在TPU（三级规划单元），人口为该TPU常驻总数"
        : "点位不在有人口TPU范围内（可能位于水上/郊野/离岛无人口区），故无人口数据",
    },
    transit: { nearest: null, monthlyEvents: null, method: "待接入港铁/巴士客流" },
    competitors: { available: false, total: null, note: "待接入 Google Places 竞品" },
    benchmark: [],
    structure: {
      sentence: tpu
        ? `所在TPU(${tpu.tpu})2021常住人口约${tpu.pop.toLocaleString()}，其中15-44岁年轻人口约${tpu.young.toLocaleString()}。客流/竞品待接入真实数据后再做位置研判。`
        : "点位不在有人口TPU范围内。客流/竞品待接入真实数据。",
      factors: [],
    },
    sources: [
      {
        name: "2021 人口普查（政府统计处）",
        status: "real",
        note: "人口数字为真实普查数据；边界经规划署TPU转换。",
      },
      {
        name: "香港布局骨架（商圈/港铁占位）",
        status: "proxy",
        note: "商圈为中心点+半径圆示意，港铁为线路主干站点近似；坐标非精确 GIS，不构成选址依据。",
      },
    ],
  });
}