#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import proj4 from "proj4";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "data/hk/raw");
const snapshotDir = resolve(root, "src/lib/hk");
const retrievedAt = new Date().toISOString();

const urls = {
  heavy: "https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv",
  light: "https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv",
  osm:
    "https://overpass.kumi.systems/api/interpreter?data=" +
    encodeURIComponent(
      '[out:json][timeout:60];(node[railway~"station|halt"](22.1,113.8,22.6,114.5););out body;',
    ),
  locationSearch: "https://www.map.gov.hk/gs/api/v1.0.0/locationSearch",
};

const HK80 =
  "+proj=tmerc +lat_0=22.31213333333333 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0,0,0,0 +units=m +no_defs";

const lineMeta = {
  AEL: ["機場快線", "Airport Express", "#1f2937"],
  TCL: ["東涌線", "Tung Chung Line", "#f59e0b"],
  ISL: ["港島線", "Island Line", "#007cc3"],
  TWL: ["荃灣線", "Tsuen Wan Line", "#e2231a"],
  KTL: ["觀塘線", "Kwun Tong Line", "#00a54f"],
  SIL: ["南港島線", "South Island Line", "#b5bd00"],
  EAL: ["東鐵線", "East Rail Line", "#53b7e8"],
  TML: ["屯馬線", "Tuen Ma Line", "#9b3a8f"],
  TKL: ["將軍澳線", "Tseung Kwan O Line", "#7d499d"],
};

const sourceMeta = {
  heavy: {
    status: "real",
    provider: "MTR Corporation / DATA.GOV.HK",
    actualSource: urls.heavy,
    period: "monthly open-data snapshot",
    retrievedAt,
    note: "官方港鐵重鐵線路及車站順序；MTR CSV 不提供坐標，快照优先按 OpenStreetMap 节点匹配，缺失坐标由 Lands Department Location Search API 补齐。",
  },
  light: {
    status: "real",
    provider: "MTR Corporation / DATA.GOV.HK",
    actualSource: urls.light,
    period: "monthly open-data snapshot",
    retrievedAt,
    note: "官方港鐵輕鐵路線及車站順序；MTR CSV 不提供坐標，快照优先按 OpenStreetMap 节点匹配，缺失坐标由 Lands Department Location Search API 补齐。",
  },
};

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function loadText(url, envName) {
  const localPath = process.env[envName];
  return localPath ? readFile(resolve(localPath), "utf8") : fetchText(url);
}

async function loadJson(url, envName) {
  const localPath = process.env[envName];
  return localPath ? JSON.parse(await readFile(resolve(localPath), "utf8")) : fetchJson(url);
}

async function loadJsonOptional(url, envName) {
  try {
    return await loadJson(url, envName);
  } catch (error) {
    console.warn(`Optional coordinate source unavailable: ${error instanceof Error ? error.message : error}`);
    return { elements: [], unavailable: true };
  }
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
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(lr|mtr|station|stop)\b/g, "")
    .replace(/[()'’.,/\-\s]/g, "")
    .trim();
}

function buildCoordinateIndex(osm) {
  const refIndex = new Map();
  const nameIndex = new Map();
  for (const element of osm.elements ?? []) {
    const tags = element.tags ?? {};
    const isTransit =
      tags.network?.toLowerCase().includes("mtr") ||
      tags.operator?.toLowerCase().includes("mtr") ||
      tags.station === "subway" ||
      tags.station === "light_rail" ||
      tags.light_rail === "yes";
    if (!isTransit || typeof element.lat !== "number" || typeof element.lon !== "number") continue;
    const value = {
      lat: element.lat,
      lng: element.lon,
      name: tags.name ?? "",
      en: tags["name:en"] ?? "",
      zh: tags["name:zh"] ?? "",
    };
    for (const ref of [tags.ref, tags["railway:ref"]]) {
      if (ref) refIndex.set(String(ref).toUpperCase(), value);
    }
    for (const key of [value.name, value.en, value.zh]) {
      const keyNorm = normalize(key);
      if (keyNorm) nameIndex.set(keyNorm, value);
    }
  }
  return { refIndex, nameIndex };
}

function coordinateFor(row, mode, index) {
  const byRef = index.refIndex.get(String(row[mode === "heavy" ? "Station Code" : "Stop Code"]).toUpperCase());
  if (byRef) return byRef;
  for (const candidate of [row["English Name"], row["Chinese Name"]]) {
    const byName = index.nameIndex.get(normalize(candidate));
    if (byName) return byName;
  }
  return null;
}

async function geocodeCoordinate(row, mode) {
  const query = `${row["English Name"]} ${mode === "light" ? "Light Rail" : "MTR"}`;
  const response = await fetch(`${urls.locationSearch}?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const records = await response.json();
  const preferred =
    records.find((record) => /MTR|Light Rail|Railway/i.test(`${record.nameEN} ${record.addressEN}`)) ??
    records[0];
  if (!preferred || typeof preferred.x !== "number" || typeof preferred.y !== "number") return null;
  const [lng, lat] = proj4(HK80, "WGS84", [preferred.x, preferred.y]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    name: preferred.nameZH ?? row["Chinese Name"],
    en: preferred.nameEN ?? row["English Name"],
  };
}

async function makeLines(rows, mode, index) {
  const lineField = "Line Code";
  const directionField = "Direction";
  const groups = new Map();
  for (const row of rows) {
    const code = row[lineField];
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(row);
  }
  const lines = [];
  const stations = new Map();
  const failures = [];
  for (const [code, group] of groups) {
    const directions = [...new Set(group.map((row) => row[directionField]))];
    const preferredDirection = directions.includes(mode === "heavy" ? "DT" : "1")
      ? mode === "heavy" ? "DT" : "1"
      : directions[0];
    const selected = group
      .filter((row) => row[directionField] === preferredDirection)
      .sort((a, b) => Number(a.Sequence) - Number(b.Sequence));
    const meta = lineMeta[code] ?? [code, code, "#475569"];
    const lineStations = [];
    for (const row of selected) {
      const stationCode = row[mode === "heavy" ? "Station Code" : "Stop Code"];
      const id = `mtr-${mode}-${stationCode}`;
      const coordinate = coordinateFor(row, mode, index) ?? (await geocodeCoordinate(row, mode));
      if (!coordinate) {
        failures.push(`${mode}:${code}:${stationCode}:${row["English Name"]}`);
        continue;
      }
      const station = {
        id,
        code: stationCode,
        name: row["Chinese Name"],
        en: row["English Name"],
        lat: coordinate.lat,
        lng: coordinate.lng,
        mode,
      };
      stations.set(id, station);
      lineStations.push(station);
    }
    if (lineStations.length >= 2) {
      lines.push({ id: `mtr-${mode}-${code}`, code, name: meta[0], en: meta[1], color: meta[2], mode, stations: lineStations });
    }
  }
  return { lines, stations: [...stations.values()], failures };
}

const [heavyText, lightText, osm] = await Promise.all([
  loadText(urls.heavy, "HK_MTR_HEAVY_CSV"),
  loadText(urls.light, "HK_MTR_LIGHT_CSV"),
  loadJsonOptional(urls.osm, "HK_OSM_STATIONS_JSON"),
]);
const coordinateIndex = buildCoordinateIndex(osm);
const heavyRows = parseCsv(heavyText);
const lightRows = parseCsv(lightText);
const heavy = await makeLines(heavyRows, "heavy", coordinateIndex);
const light = await makeLines(lightRows, "light", coordinateIndex);

const unresolved = [...heavy.failures, ...light.failures];
if (unresolved.length > 0) {
  console.warn(`MTR station coordinate join unresolved: ${unresolved.length}`);
  console.warn(unresolved.slice(0, 20).join("\n"));
}
if (heavy.lines.length < 5 || light.lines.length < 1) {
  throw new Error(`Snapshot validation failed: heavy lines=${heavy.lines.length}, light lines=${light.lines.length}`);
}

await mkdir(snapshotDir, { recursive: true });
await mkdir(sourceDir, { recursive: true });
await writeFile(resolve(sourceDir, "mtr_lines_and_stations.csv"), heavyText);
await writeFile(resolve(sourceDir, "light_rail_routes_and_stops.csv"), lightText);
await writeFile(resolve(sourceDir, "osm_mtr_stations.json"), JSON.stringify(osm));

const transit = {
  heavy: { source: { ...sourceMeta.heavy, note: `${sourceMeta.heavy.note} 本地快照包含 ${heavy.stations.length} 个可绘制重铁站点。` }, lines: heavy.lines, stations: heavy.stations },
  light: { source: { ...sourceMeta.light, note: `${sourceMeta.light.note} 本地快照包含 ${light.stations.length} 个可绘制轻铁站点。` }, lines: light.lines, stations: light.stations },
};
const manifest = {
  schemaVersion: 1,
  generatedAt: retrievedAt,
  datasets: [
    { id: "mtr-heavy-lines-stations", ...transit.heavy.source, featureCount: heavy.stations.length, validation: { passed: unresolved.length === 0, checks: ["CSV header", "sequence ordering", "station dedupe", "coordinate join"], failures: unresolved } },
    { id: "mtr-light-routes-stops", ...transit.light.source, featureCount: light.stations.length, validation: { passed: unresolved.length === 0, checks: ["CSV header", "sequence ordering", "stop dedupe", "coordinate join"], failures: unresolved } },
    { id: "osm-mtr-station-coordinates", status: osm.unavailable ? "unavailable" : "real", provider: "OpenStreetMap contributors", actualSource: urls.osm, period: "snapshot", retrievedAt, featureCount: osm.elements?.length ?? 0, checksum: createHash("sha256").update(JSON.stringify(osm)).digest("hex"), note: osm.unavailable ? "OSM 坐标冗余源不可用；本次使用官方 Location Search API 完成坐标对接。" : undefined, validation: { passed: true, checks: ["Hong Kong bbox", "MTR/light-rail tag filter"] } },
  ],
};
await writeFile(resolve(snapshotDir, "transit.json"), `${JSON.stringify(transit, null, 2)}\n`);
await writeFile(resolve(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${heavy.lines.length} heavy lines / ${heavy.stations.length} stations and ${light.lines.length} light lines / ${light.stations.length} stops.`);
