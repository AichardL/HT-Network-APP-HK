"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Coordinate } from "@/lib/geo";
import type { HkBoundaryFeature } from "@/lib/hk/districts";
import type { HkLine, HkStation } from "@/lib/hk/transit";

type FeatureCollectionLayer = { source: SourceMeta; features: HkBoundaryFeature[] };
type SourceMeta = { status: "real" | "unavailable"; provider: string; actualSource?: string; period?: string; retrievedAt?: string; note?: string };
type TpuFeature = { type: "Feature"; properties: { tpu: number; pop: number; young: number; households: number; incomeAvg: number | null; populated: boolean }; geometry: HkBoundaryFeature["geometry"] };
type PopulationLevel = "mhe" | "ppu" | "spu" | "tpu";
type PopulationLayer = { source: SourceMeta; features: HkBoundaryFeature[] };
type NearbyPopulation = { radiusKm: number; total: number; tpuCount: number; includedTpuCodes: string[]; note: string; breakdown: Record<"district" | "ppu" | "spu" | "tpu" | "mhe", { id: string; name: string; population: number }[]> };
type OverviewPayload = {
  navigation?: { districts: FeatureCollectionLayer; planningUnits: FeatureCollectionLayer; population: { source: SourceMeta; summary: { total: number; young: number; tpuCount: number }; layer: { features: TpuFeature[] }; hierarchy: Record<"district" | PopulationLevel, PopulationLayer> } };
  transit?: { heavy: { source: SourceMeta; lines: HkLine[]; stations: HkStation[] }; light: { source: SourceMeta; lines: HkLine[]; stations: HkStation[] } };
  sources?: { datasets?: { id: string; validation?: { passed: boolean; failures?: string[] } }[] };
};
type PointPayload = { hierarchy: { district: HkBoundaryFeature["properties"] | null; ppu: HkBoundaryFeature["properties"] | null; spu: HkBoundaryFeature["properties"] | null; tpu: { id: string; population: number } | null }; population: { estimate: number | null; young: number | null; households: number | null; note: string }; nearbyPopulation: NearbyPopulation; nearestStation: (HkStation & { distanceKm: number }) | null; sources: { provider: string; status: string; note: string }[]; phase: { note: string } };
type SearchResult = { name: string; nameEn: string; address: string; district: string; lat: number; lng: number };

const HK_CENTER: Coordinate = { lat: 22.3193, lng: 114.1694 };
const HK_BOUNDS: [[number, number], [number, number]] = [[22.14, 113.82], [22.56, 114.44]];

function MapClick({ onPick }: { onPick: (p: Coordinate) => void }) {
  useMapEvents({ click: (event: L.LeafletMouseEvent) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function MapNavigator({ target }: { target: Coordinate | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, target]);
  return null;
}

export default function HkBoard() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [selectedStation, setSelectedStation] = useState<HkStation | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<Coordinate | null>(null);
  const [selectedBoundary, setSelectedBoundary] = useState<HkBoundaryFeature["properties"] | null>(null);
  const [report, setReport] = useState<PointPayload | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHeavy, setShowHeavy] = useState(true);
  const [showLight, setShowLight] = useState(true);
  const [showDistricts, setShowDistricts] = useState(true);
  const [showPopulation, setShowPopulation] = useState(false);
  const [populationLevel, setPopulationLevel] = useState<PopulationLevel>("tpu");
  const [radiusKm, setRadiusKm] = useState(3);

  useEffect(() => {
    fetch("/api/hk").then((response) => response.json()).then(setOverview).catch(() => setError("地图快照加载失败"));
  }, []);

  const pick = useCallback((point: Coordinate) => {
    setSelected(point);
    setSelectedStation(null);
    setSelectedBoundary(null);
    setReport(null);
    setError("");
  }, []);

  const identifyPoint = useCallback(async (point: Coordinate, radius: number) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/hk/point?lat=${point.lat}&lng=${point.lng}&radiusKm=${radius}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "点位识别失败");
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "点位识别失败");
    } finally {
      setBusy(false);
    }
  }, []);

  const identify = useCallback(async () => {
    if (!selected) return;
    await identifyPoint(selected, radiusKm);
  }, [identifyPoint, radiusKm, selected]);

  const changeRadius = useCallback((value: number) => {
    setRadiusKm(value);
    if (selected && selectedStation) {
      void identifyPoint(selected, value);
    } else {
      setReport(null);
    }
  }, [identifyPoint, selected, selectedStation]);

  const submitSearch = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (search.trim().length < 2) return;
    setSearchBusy(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/hk/search?q=${encodeURIComponent(search.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "官方搜索失败");
      setSearchResults(data.results ?? []);
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : "官方搜索失败");
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [search]);

  const heavyLines = overview?.transit?.heavy.lines ?? [];
  const lightLines = overview?.transit?.light.lines ?? [];
  const stations = useMemo(() => [...(overview?.transit?.heavy.stations ?? []), ...(overview?.transit?.light.stations ?? [])], [overview]);
  const districtFeatures = overview?.navigation?.districts.features ?? [];
  const populationLayers = overview?.navigation?.population.hierarchy;
  const activePopulationFeatures = populationLayers?.[populationLevel]?.features ?? [];

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
        <h1 className="text-sm font-semibold">香港网归地图底座 · Phase 1</h1>
        <Badge variant="outline">公开只读 · 官方快照</Badge>
        <form className="ml-auto flex gap-2" onSubmit={submitSearch}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="官方地址 / 地名搜索" className="w-56 rounded-md border bg-background px-2 py-1 text-sm" />
          <Button size="sm" type="submit" disabled={searchBusy}>{searchBusy ? "搜索中…" : "搜索"}</Button>
        </form>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-muted/30 p-3">
          <section className="rounded-lg border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold">图层</h2>
            <div className="grid gap-2 text-xs">
              <Toggle label={`18 区导航 (${districtFeatures.length || "—"})`} checked={showDistricts} onChange={setShowDistricts} />
              <Toggle label={`人口分区层 · ${populationLevel.toUpperCase()} (${activePopulationFeatures.length || "—"})`} checked={showPopulation} onChange={setShowPopulation} />
              {showPopulation && <label className="ml-5 flex items-center gap-2 text-[11px] text-muted-foreground">查看层级<select value={populationLevel} onChange={(event) => setPopulationLevel(event.target.value as PopulationLevel)} className="rounded border bg-background px-1 py-0.5 text-xs text-foreground"><option value="mhe">主要屋苑 · {populationLayers?.mhe.features.length ?? "—"} 个</option><option value="ppu">PPU · {populationLayers?.ppu.features.length ?? "—"} 区</option><option value="spu">SPU · {populationLayers?.spu.features.length ?? "—"} 区</option><option value="tpu">TPU · {populationLayers?.tpu.features.length ?? "—"} 区</option></select></label>}
              <Toggle label={`港铁重铁 (${heavyLines.length} 条)`} checked={showHeavy} onChange={setShowHeavy} />
              <Toggle label={`港铁轻铁 (${lightLines.length} 条)`} checked={showLight} onChange={setShowLight} />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold">官方搜索结果</h2>
            {searchError && <p className="text-xs text-red-600">{searchError}</p>}
            {searchResults.length === 0 && !searchError && <p className="text-xs text-muted-foreground">输入地址、建筑物、地名或设施名称；搜索只负责定位。</p>}
            <div className="grid gap-1">
              {searchResults.map((result, index) => <button key={`${result.lat}-${result.lng}-${index}`} type="button" className="rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { setNavigationTarget(result); pick(result); setSearchResults([]); }}><span className="font-medium">{result.name}</span><span className="ml-1 text-muted-foreground">{result.nameEn}</span><div className="text-muted-foreground">{result.address} · {result.district}</div></button>)}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold">当前点位</h2>
            {!selected && <p className="text-xs text-muted-foreground">点击地图或搜索结果，查看 District / PPU / SPU / TPU 和指定半径内的居民人口。</p>}
            {selected && <div className="grid gap-2 text-xs"><p className="font-mono text-muted-foreground">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</p>{selectedStation && <div className="rounded-md bg-sky-50 p-2 text-sky-900"><p className="font-semibold">{selectedStation.name} <span className="font-normal">{selectedStation.en}</span></p><p>{selectedStation.mode === "heavy" ? "港铁重铁" : "港铁轻铁"} · {selectedStation.code}</p><p className="text-sky-700">线路和站点来自 MTR 官方开放数据；点击站点后已自动查询周边人口。</p></div>}<div className="rounded-md border bg-amber-50/70 p-2"><p className="mb-1 font-semibold text-amber-950">{selectedStation ? "站点周边人口查询半径" : "周边 TPU 覆盖人口近似值"}</p><div className="flex flex-wrap gap-1">{[0.5, 1, 2, 3, 5].map((value) => <button key={value} type="button" onClick={() => changeRadius(value)} className={`rounded border px-2 py-1 ${radiusKm === value ? "border-amber-700 bg-amber-100 font-semibold" : "bg-white"}`}>{value} km</button>)}</div><p className="mt-1 text-[11px] text-amber-800">{selectedStation ? `以 ${selectedStation.name} 站点坐标自动汇总 2021 年常住人口；切换半径会自动更新。` : "识别时按 2021 年常住人口，以 TPU 单元近似汇总；结果会列出纳入计算的 TPU 编码。"}</p></div><Button size="sm" onClick={identify} disabled={busy}>{busy ? "识别中…" : "识别此位置"}</Button><Button size="sm" variant="ghost" onClick={() => { setSelected(null); setSelectedStation(null); setReport(null); }}>清除</Button></div>}
            {report && <PointCard report={report} station={selectedStation} />}
            {selectedBoundary && <BoundaryCard feature={selectedBoundary} />}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </section>

          <p className="text-[11px] leading-4 text-muted-foreground">人口为统计期常住人口，不代表实时到访人口。Phase 1 不提供逐站客流热力、综合总分、商业区排名或候选点结论。</p>
        </aside>

        <main className="relative min-w-0 flex-1">
          <MapContainer center={HK_CENTER} zoom={12} minZoom={10} maxZoom={18} bounds={HK_BOUNDS} className="z-0 h-full w-full" scrollWheelZoom>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClick onPick={pick} />
            <MapNavigator target={navigationTarget} />
            {showDistricts && districtFeatures.map((feature) => <BoundaryPolygons key={feature.properties.id} feature={feature} selected={selectedBoundary?.id === feature.properties.id} onSelect={setSelectedBoundary} />)}
            {showPopulation && activePopulationFeatures.map((feature) => <BoundaryPolygons key={feature.properties.id} feature={feature} selected={selectedBoundary?.id === feature.properties.id} onSelect={setSelectedBoundary} population />)}
            {showHeavy && heavyLines.map((line) => <Polyline key={line.id} positions={line.stations.map((station) => [station.lat, station.lng] as [number, number])} pathOptions={{ color: line.color, weight: 4, opacity: 0.9 }} />)}
            {showLight && lightLines.map((line) => <Polyline key={line.id} positions={line.stations.map((station) => [station.lat, station.lng] as [number, number])} pathOptions={{ color: line.color, weight: 3, opacity: 0.75, dashArray: "4 4" }} />)}
            {(showHeavy || showLight) && stations.map((station) => ((station.mode === "heavy" ? showHeavy : showLight) ? <CircleMarker key={station.id} center={[station.lat, station.lng]} radius={5} pathOptions={{ color: "#fff", weight: 1.5, fillColor: station.mode === "heavy" ? "#0f172a" : "#f97316", fillOpacity: 1 }} eventHandlers={{ click: () => { pick(station); setSelectedStation(station); void identifyPoint(station, radiusKm); } }} /> : null))}
            {selectedStation && <CircleMarker center={[selectedStation.lat, selectedStation.lng]} radius={8} pathOptions={{ color: "#0f172a", weight: 3, fillColor: "#38bdf8", fillOpacity: 1 }} />}
            {selected && <CircleMarker center={[selected.lat, selected.lng]} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: "#b91c1c", fillOpacity: 1 }} />}
            {selected && <Circle center={[selected.lat, selected.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#b45309", weight: 1.5, dashArray: "5 5", fillColor: "#f59e0b", fillOpacity: 0.05 }} />}
          </MapContainer>
          <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-white/90 px-2 py-1 text-[11px] shadow">{overview ? "本地快照已加载" : "正在加载快照…"} · 点击边界或站点查看口径</div>
        </main>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-emerald-600" />{label}</label>;
}

function BoundaryPolygons({ feature, selected, onSelect, population = false }: { feature: HkBoundaryFeature; selected: boolean; onSelect: (properties: HkBoundaryFeature["properties"]) => void; population?: boolean }) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const fill = population ? populationColor(feature.properties.population ?? 0) : feature.properties.level === "district" ? "#0f766e" : "#7c3aed";
  return <>{polygons.map((polygon, index) => <Polygon key={`${feature.properties.id}-${index}`} positions={polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))} pathOptions={{ color: selected ? "#0f172a" : fill, weight: selected ? 3 : population ? 0.7 : 1.2, fillColor: fill, fillOpacity: population ? 0.3 : selected ? 0.16 : 0.04 }} eventHandlers={{ click: () => onSelect(feature.properties) }} />)}</>;
}

function populationColor(population: number) {
  if (population <= 0) return "#cbd5e1";
  if (population < 20_000) return "#bfdbfe";
  if (population < 50_000) return "#60a5fa";
  if (population < 100_000) return "#2563eb";
  return "#1e3a8a";
}

function BoundaryCard({ feature }: { feature: HkBoundaryFeature["properties"] }) {
  return <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs"><p className="font-semibold">{feature.name} <span className="font-normal text-muted-foreground">{feature.en}</span></p><p>层级：{feature.level.toUpperCase()} · 统计期：{feature.period}</p>{feature.population != null && <p>人口：{feature.population.toLocaleString()}（不代表实时到访）</p>}</div>;
}

function PointCard({ report, station }: { report: PointPayload; station: HkStation | null }) {
  const { district, ppu, spu, tpu } = report.hierarchy;
  return <div className="mt-2 grid gap-2 text-xs"><div className="rounded-md bg-muted/50 p-2"><p className="font-semibold">空间层级</p><p>District：{district?.name ?? "unavailable"}</p><p>PPU：{ppu?.name ?? "unavailable"}</p><p>SPU：{spu?.name ?? "unavailable"}</p><p>所在 TPU 编码：{tpu ? `${tpu.id} · ${tpu.population.toLocaleString()} 人` : "unavailable"}</p></div><div className="rounded-md bg-emerald-50 p-2 text-emerald-950"><p className="font-semibold">{station ? "站点周边" : "周边"} {report.nearbyPopulation.radiusKm} km TPU 覆盖人口近似值</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{report.nearbyPopulation.total.toLocaleString()} 人</p><p className="text-[11px] text-emerald-800">纳入 {report.nearbyPopulation.tpuCount} 个 TPU · {report.nearbyPopulation.note}</p><NearbyBreakdown nearby={report.nearbyPopulation} /></div><div className="rounded-md bg-muted/50 p-2"><p className="font-semibold">所在单元人口</p><p>{report.population.estimate?.toLocaleString() ?? "unavailable"} · 2021 常住人口</p><p>{report.population.note}</p></div><div className="rounded-md bg-muted/50 p-2"><p className="font-semibold">附近站点</p><p>{report.nearestStation ? `${report.nearestStation.name} · ${report.nearestStation.distanceKm.toFixed(2)} km` : "unavailable"}</p></div></div>;
}

function NearbyBreakdown({ nearby }: { nearby: NearbyPopulation }) {
  const sections: [keyof NearbyPopulation["breakdown"], string][] = [["district", "行政区"], ["ppu", "PPU"], ["spu", "SPU"], ["mhe", "主要屋苑"]];
  return <div className="mt-2 grid gap-1 border-t border-emerald-200 pt-2"><p className="font-medium text-emerald-900">纳入计算的 TPU 编码（{nearby.includedTpuCodes.length} 个）</p><p className="max-h-16 overflow-y-auto rounded bg-white/70 p-1 font-mono text-[11px] leading-5">{nearby.includedTpuCodes.map((code) => `TPU ${code}`).join(" · ") || "—"}</p><p className="text-[10px] text-emerald-800">主要屋苑为独立层级明细，不与 TPU 总人口重复相加。</p>{sections.map(([level, label]) => <div key={level} className="flex items-start justify-between gap-2"><span className="shrink-0 text-emerald-800">{label}</span><span className="text-right">{nearby.breakdown[level].slice(0, 3).map((item) => `${item.name} ${item.population.toLocaleString()}`).join(" · ") || "—"}</span></div>)}</div>;
}
