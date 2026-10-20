import proj4 from "proj4";
import { json } from "@/lib/hk-api";
import { SOURCE_URLS } from "@/lib/hk/provenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HK80 =
  "+proj=tmerc +lat_0=22.31213333333333 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0,0,0,0 +units=m +no_defs";

type OfficialSearchRecord = {
  addressZH?: string;
  nameZH?: string;
  districtZH?: string;
  x?: number;
  y?: number;
  nameEN?: string;
  addressEN?: string;
  districtEN?: string;
};

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return json({ error: "查询词长度需为 2–80 个字符" }, 400);
  try {
    const response = await fetch(`${SOURCE_URLS.locationSearch}?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return json({ error: `官方地址服务暂不可用（${response.status}）` }, 503);
    const records = (await response.json()) as OfficialSearchRecord[];
    return json({
      query: q,
      source: {
        status: "real",
        provider: "Lands Department GeoInfo Map / Location Search API",
        actualSource: SOURCE_URLS.locationSearch,
        retrievedAt: new Date().toISOString(),
        note: "仅用于定位；不会生成客流、评分或选址结论。",
      },
      results: records.slice(0, 10).flatMap((record) => {
        if (typeof record.x !== "number" || typeof record.y !== "number") return [];
        const [lng, lat] = proj4(HK80, "WGS84", [record.x, record.y]);
        return [{
          name: record.nameZH ?? record.nameEN ?? q,
          nameEn: record.nameEN ?? "",
          address: record.addressZH ?? record.addressEN ?? "",
          district: record.districtZH ?? record.districtEN ?? "",
          lat,
          lng,
        }];
      }),
    });
  } catch {
    return json({ error: "官方地址服务连接失败；请稍后重试" }, 503);
  }
}
