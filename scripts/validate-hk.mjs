import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));

const transit = await readJson("src/lib/hk/transit.json");
const manifest = await readJson("src/lib/hk/manifest.json");
const tpu = await readJson("src/lib/hk/tpu-population.json");
const failures = [];

if (tpu.features?.length !== 292) failures.push(`TPU feature count expected 292, got ${tpu.features?.length ?? 0}`);
for (const mode of ["heavy", "light"]) {
  const snapshot = transit[mode];
  if (snapshot.source.status !== "real") failures.push(`${mode} source is not real`);
  if (!snapshot.lines.length) failures.push(`${mode} has no lines`);
  if (new Set(snapshot.stations.map((station) => station.id)).size !== snapshot.stations.length) failures.push(`${mode} has duplicate station ids`);
  for (const station of snapshot.stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) failures.push(`${mode} station ${station.id} has invalid coordinate`);
  }
}
for (const dataset of manifest.datasets ?? []) {
  if (dataset.validation && !dataset.validation.passed) failures.push(`${dataset.id}: ${(dataset.validation.failures ?? []).slice(0, 3).join(", ")}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`HK snapshot valid: ${transit.heavy.lines.length} heavy lines, ${transit.light.lines.length} light lines, ${tpu.features.length} TPU features.`);
