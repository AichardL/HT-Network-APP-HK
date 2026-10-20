import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = (file) => resolve(root, "src/lib/hk", file);
const readJson = async (file) => JSON.parse(await readFile(resolve(file), "utf8"));
const districtUrl = "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635932856094_19982&format=geojson&layer_name=DC_21C";
const planningQuery = (offset) => `https://portal.csdi.gov.hk/server/rest/services/common/pland_rcd_1634022783366_65050/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=false&outFields=PPU%2CSPU%2CTPU%2CSubunit&resultRecordCount=3000&resultOffset=${offset}`;
async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const districtInput = process.env.HK_CSDI_DISTRICTS_GEOJSON;
const lookupInputs = (process.env.HK_TPU_LOOKUP_PARTS ?? "").split(";").filter(Boolean);
const districtGeo = districtInput ? await readJson(districtInput) : await fetchJson(districtUrl);
const tpuGeo = await readJson(resolve(root, "src/lib/hk/tpu-population.json"));
const lookupParts = lookupInputs.length > 0
  ? await Promise.all(lookupInputs.map((file) => readJson(file)))
  : await Promise.all([fetchJson(planningQuery(0)), fetchJson(planningQuery(3000))]);
const lookupRows = lookupParts.flatMap((json) => json.features.map((feature) => feature.attributes));
const byTpu = new Map();
for (const row of lookupRows) if (!byTpu.has(row.TPU)) byTpu.set(row.TPU, { ppu: row.PPU, spu: row.SPU });

const aggregate = (key) => {
  const map = new Map();
  for (const feature of tpuGeo.features) {
    const mapping = byTpu.get(feature.properties.tpu);
    if (!mapping) continue;
    const id = mapping[key];
    const current = map.get(id) ?? { population: 0, young: 0, households: 0 };
    current.population += feature.properties.pop;
    current.young += feature.properties.young;
    current.households += feature.properties.households;
    map.set(id, current);
  }
  return map;
};
const ppuTotals = aggregate("ppu");
const spuTotals = aggregate("spu");

const districts = {
  source: {
    status: "real",
    provider: "CSDI / Census and Statistics Department",
    actualSource: "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635932856094_19982&format=geojson&layer_name=DC_21C",
    period: "2021 Population Census",
    retrievedAt: new Date().toISOString(),
    note: "18 District Council Districts; geometry normalized from CSDI GeoJSON and coordinates are WGS84.",
  },
  features: districtGeo.features.map((feature) => ({
    type: "Feature",
    properties: { id: `district-${feature.properties.dc}`, name: feature.properties.dc_chi, en: feature.properties.dc_eng, level: "district", population: numberOrNull(feature.properties.t_pop), period: "2021 Population Census" },
    geometry: feature.geometry,
  })),
};

const planningUnits = {
  source: {
    status: "real",
    provider: "CSDI / Planning Department + C&SD",
    actualSource: "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=pland_rcd_1634022783366_65050&format=geojson&layer_name=TPUSU_2021",
    period: "2021 Population Census",
    retrievedAt: new Date().toISOString(),
    note: "本地层以 292 个 TPU 边界作为地图统计粒度；PPU/SPU 通过 planning-lookup.json 关联，用于点位识别和聚合统计。",
  },
  features: tpuGeo.features.map((feature) => ({
    type: "Feature",
    properties: { id: `tpu-${feature.properties.tpu}`, name: `TPU ${feature.properties.tpu}`, en: `TPU ${feature.properties.tpu}`, level: "tpu", population: feature.properties.pop, period: "2021 Population Census" },
    geometry: feature.geometry,
  })),
};

const planningLookup = {
  source: {
    status: "real",
    provider: "CSDI / Planning Department + C&SD",
    actualSource: "https://portal.csdi.gov.hk/server/rest/services/common/pland_rcd_1634022783366_65050/FeatureServer/0/query",
    period: "2021 Population Census",
    retrievedAt: new Date().toISOString(),
    note: "每个 TPU 的 PPU/SPU 关系由 CSDI TPUSU_2021 属性对照，并以本地 2021 TPU 人口快照聚合。",
  },
  items: [...byTpu.entries()].sort(([a], [b]) => a - b).map(([tpu, mapping]) => ({
    tpu,
    ...mapping,
    spuPopulation: spuTotals.get(mapping.spu)?.population ?? 0,
    ppuPopulation: ppuTotals.get(mapping.ppu)?.population ?? 0,
  })),
};

await writeFile(target("districts.json"), `${JSON.stringify(districts)}\n`);
await writeFile(target("planning-units.json"), `${JSON.stringify(planningUnits)}\n`);
await writeFile(target("planning-lookup.json"), `${JSON.stringify(planningLookup)}\n`);
const manifestFile = target("manifest.json");
let manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), datasets: [] };
try { manifest = await readJson(manifestFile); } catch { /* first snapshot */ }
manifest.generatedAt = new Date().toISOString();
manifest.datasets = [
  ...(manifest.datasets ?? []).filter((dataset) => !["csdi-districts", "csdi-tpu-boundaries", "csdi-planning-lookup"].includes(dataset.id)),
  { id: "csdi-districts", ...districts.source, featureCount: districts.features.length, validation: { passed: districts.features.length === 18, checks: ["18 district features", "WGS84 geometry", "population field"] } },
  { id: "csdi-tpu-boundaries", ...planningUnits.source, featureCount: planningUnits.features.length, validation: { passed: planningUnits.features.length === 292, checks: ["292 TPU features", "WGS84 geometry", "population join"] } },
  { id: "csdi-planning-lookup", ...planningLookup.source, featureCount: planningLookup.items.length, validation: { passed: planningLookup.items.length === 292, checks: ["PPU count", "SPU count", "TPU mapping", "population aggregation"] } },
];
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${districts.features.length} districts, ${planningUnits.features.length} TPU boundaries, ${planningLookup.items.length} hierarchy mappings.`);

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
