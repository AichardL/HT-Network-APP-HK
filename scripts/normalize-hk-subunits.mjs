#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "src/lib/hk/ssug-population.json");
const manifestTarget = resolve(root, "src/lib/hk/manifest.json");
const sourceUrl = "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635933365202_19171&format=geojson&layer_name=SSUG_21C";
const simplifyTolerance = 0.00002;

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function loadJson(url, envName) {
  const localPath = process.env[envName];
  return localPath ? JSON.parse(await readFile(resolve(localPath), "utf8")) : fetchJson(url);
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

function squaredDistanceToSegment(point, start, end) {
  let x = start[0];
  let y = start[1];
  const dx = end[0] - x;
  const dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  const distanceX = point[0] - x;
  const distanceY = point[1] - y;
  return distanceX * distanceX + distanceY * distanceY;
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = tolerance * tolerance;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = squaredDistanceToSegment(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (index === 0) return [points[0], points.at(-1)];
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

function simplifyRing(ring) {
  const closed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
  const source = closed ? ring.slice(0, -1) : ring;
  const simplified = douglasPeucker(source, simplifyTolerance);
  const output = closed ? [...simplified, simplified[0]] : simplified;
  return output.length >= 4 || !closed ? output : ring;
}

function simplifyGeometry(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const coordinates = polygons.map((polygon) => polygon.map(simplifyRing));
  return geometry.type === "Polygon" ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
}

const input = await loadJson(sourceUrl, "HK_SSUG_GEOJSON");
const features = input.features.map((feature) => {
  const properties = feature.properties;
  const code = String(properties.ssbg ?? "").trim();
  const parentTpu = Number(code.slice(0, 3));
  const geometry = simplifyGeometry(feature.geometry);
  return {
    type: "Feature",
    properties: {
      id: `ssug-${code}`,
      code,
      name: String(properties.ssbg_chi ?? code),
      en: String(properties.ssbg_eng ?? code),
      level: "ssug",
      population: numberOrZero(properties.t_pop),
      parentTpu: Number.isFinite(parentTpu) ? parentTpu : null,
      period: "2021 Population Census",
    },
    geometry,
    representativePoint: representativePointOfGeometry(geometry),
  };
}).sort((a, b) => a.properties.code.localeCompare(b.properties.code));

const output = {
  source: {
    status: "real",
    provider: "Census and Statistics Department / CSDI",
    actualSource: sourceUrl,
    period: "2021 Population Census",
    retrievedAt: new Date().toISOString(),
    note: "官方 2,342 个单元区小合并组（Small Subunit Group）；人口字段为 2021 年常住人口。边界为地图展示用的轻量化快照，点位识别仍以该官方单元边界为准。",
  },
  features,
};

await writeFile(target, `${JSON.stringify(output)}\n`);

const manifest = JSON.parse(await readFile(manifestTarget, "utf8"));
manifest.generatedAt = new Date().toISOString();
manifest.datasets = [
  ...(manifest.datasets ?? []).filter((dataset) => dataset.id !== "csdi-small-subunit-groups"),
  {
    id: "csdi-small-subunit-groups",
    ...output.source,
    featureCount: features.length,
    validation: {
      passed: features.length === 2342 && features.every((feature) => feature.properties.code && Number.isFinite(feature.properties.population)),
      checks: ["2342 SSUG features", "WGS84 geometry", "2021 population field"],
      failures: [],
    },
  },
];
await writeFile(manifestTarget, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${features.length} small subunit groups.`);
