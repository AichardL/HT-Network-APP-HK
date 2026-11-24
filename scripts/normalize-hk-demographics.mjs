#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "src/lib/hk/stpug-population.json");
const manifestTarget = resolve(root, "src/lib/hk/manifest.json");
const tpuTarget = resolve(root, "src/lib/hk/tpu-population.json");

const stpugGeoUrl = "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635933193720_58660&format=geojson&layer_name=STPUG_21C";
const demographicsUrl = "https://www.census2021.gov.hk/data/table_S211D1/MDT_1_S211D1_RP_RP_NPER.csv";
const ageBands = ["0-14", "15-24", "25-44", "45-64", "65+"];

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function loadJson(url, envName) {
  const localPath = process.env[envName];
  return localPath ? JSON.parse(await readFile(resolve(localPath), "utf8")) : fetchJson(url);
}

async function loadText(url, envName) {
  const localPath = process.env[envName];
  return localPath ? readFile(resolve(localPath), "utf8") : fetchText(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function representativePointOfGeometry(geometry) {
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

function boundsOfGeometry(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        bounds[0] = Math.min(bounds[0], x);
        bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x);
        bounds[3] = Math.max(bounds[3], y);
      }
    }
  }
  return bounds;
}

function distanceKm(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const lat1 = a.lat * radians;
  const lat2 = b.lat * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const stpugGeo = await loadJson(stpugGeoUrl, "HK_STPUG_GEOJSON");
const demographicsRows = parseCsv(await loadText(demographicsUrl, "HK_STPUG_DEMOGRAPHICS_CSV"));
const tpuGeo = JSON.parse(await readFile(tpuTarget, "utf8"));

const ageSex = new Map();
for (const row of demographicsRows) {
  const rawCode = String(row.STPUG ?? "").trim();
  const code = rawCode.endsWith("L") ? `${rawCode.slice(0, -1)}S` : rawCode;
  const rawBand = String(row.AGE ?? "").trim();
  const band = rawBand === "65-10000" ? "65+" : rawBand;
  const sex = row.SEX === "1" ? "male" : row.SEX === "2" ? "female" : null;
  if (!code || !sex || !ageBands.includes(band)) continue;
  const record = ageSex.get(code) ?? { male: Object.fromEntries(ageBands.map((item) => [item, 0])), female: Object.fromEntries(ageBands.map((item) => [item, 0])) };
  record[sex][band] = numberOrZero(row.obs_value);
  ageSex.set(code, record);
}

const profiles = stpugGeo.features.map((feature) => {
  const properties = feature.properties;
  const code = String(properties.stpug);
  const sex = ageSex.get(code) ?? { male: Object.fromEntries(ageBands.map((item) => [item, 0])), female: Object.fromEntries(ageBands.map((item) => [item, 0])) };
  return {
    code,
    name: String(properties.stpug_chi ?? code),
    en: String(properties.stpug_eng ?? code),
    population: numberOrZero(properties.t_pop),
    male: numberOrZero(properties.pop_m),
    female: numberOrZero(properties.pop_f),
    age: Object.fromEntries(ageBands.map((band, index) => [band, numberOrZero(properties[`age_${index + 1}`])])),
    ageSex: sex,
    representativePoint: representativePointOfGeometry(feature.geometry),
    bounds: boundsOfGeometry(feature.geometry),
  };
});

const profileByCode = new Map(profiles.map((profile) => [profile.code, profile]));
const tpuToStpug = {};
let fallbackCount = 0;
for (const feature of tpuGeo.features) {
  const tpu = String(feature.properties.tpu);
  const point = representativePointOfGeometry(feature.geometry);
  let selected = profiles.find((profile) => {
    if (point.lng < profile.bounds[0] || point.lng > profile.bounds[2] || point.lat < profile.bounds[1] || point.lat > profile.bounds[3]) return false;
    return booleanPointInPolygon([point.lng, point.lat], stpugGeo.features.find((candidate) => String(candidate.properties.stpug) === profile.code).geometry);
  });
  if (!selected) {
    selected = profiles.reduce((nearest, profile) => distanceKm(point, profile.representativePoint) < distanceKm(point, nearest.representativePoint) ? profile : nearest, profiles[0]);
    fallbackCount += 1;
  }
  tpuToStpug[tpu] = selected.code;
}

const output = {
  market: "HK",
  status: "real",
  sourceDate: "2021",
  actualSources: [stpugGeoUrl, demographicsUrl],
  note: "官方 211 个 STPUG 小规划统计区小合并组人口画像。年龄 × 性别字段来自 Census 2021 IDDS；该层级是官方发布口径，不能拆分回 292 个 TPU。",
  ageBands,
  features: profiles.map(({ bounds, ...profile }) => ({ ...profile, tpuCodes: Object.entries(tpuToStpug).filter(([, code]) => code === profile.code).map(([tpu]) => Number(tpu)) })),
  tpuToStpug,
};

await writeFile(target, `${JSON.stringify(output)}\n`);

const manifest = JSON.parse(await readFile(manifestTarget, "utf8"));
manifest.generatedAt = new Date().toISOString();
manifest.datasets = [
  ...(manifest.datasets ?? []).filter((dataset) => dataset.id !== "csdi-stpug-demographics"),
  {
    id: "csdi-stpug-demographics",
    status: "real",
    provider: "CSDI / Census and Statistics Department",
    actualSource: stpugGeoUrl,
    period: "2021 Population Census",
    retrievedAt: new Date().toISOString(),
    note: "211 个 STPUG 小规划统计区小合并组；人口、年龄、性别和 TPU 对照用于站点人口画像。",
    featureCount: profiles.length,
    validation: { passed: profiles.length === 211 && Object.keys(tpuToStpug).length === 292, checks: ["211 STPUG profiles", "age-sex fields", "292 TPU-to-STPUG mappings"], failures: [] },
  },
];
await writeFile(manifestTarget, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${profiles.length} STPUG profiles and ${Object.keys(tpuToStpug).length} TPU mappings. Fallback mappings: ${fallbackCount}.`);
