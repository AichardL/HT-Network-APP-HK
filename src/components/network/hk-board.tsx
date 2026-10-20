"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Circle, Polygon, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HK_AREAS,
  HK_LINES,
  HK_MARKET_SOURCE,
  HK_TYPE_COLOR,
  type HkArea,
  type HkStation,
} from "@/lib/hk/skeleton";
import type { Coordinate } from "@/lib/geo";

type HkTpuFeature = {
  type: "Feature";
  properties: {
    tpu: number;
    pop: number;
    young: number;
    households: number;
    incomeAvg: number | null;
    populated: boolean;
  };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

type PointPayload = {
  point: Coordinate;
  radiusKm: number;
  areasWithin: { id: string; name: string; en: string; type: string }[];
  population: {
    estimate: number | null;
    density: number | null;
    young: number | null;
    households?: number | null;
    tpu?: number | null;
    source?: { status: string; actualSource?: string; note?: string };
    method: string;
  };
  transit: { nearest: null; monthlyEvents: null; method: string };
  competitors: { available: boolean; total: number | null; note: string };
  benchmark: unknown[];
  structure: { sentence: string; factors: unknown[] };
  sources: { name: string; status: string; note: string }[];
};

const HK_CENTER: Coordinate = { lat: 22.3193, lng: 114.1694 };
const HK_BOUNDS: [[number, number], [number, number]] = [
  [22.14, 113.82],
  [22.56, 114.44],
];

function MapClick({ onPick }: { onPick: (p: Coordinate) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function HkBoard() {
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [selectedStation, setSelectedStation] = useState<HkStation | null>(null);
  const [selectedArea, setSelectedArea] = useState<HkArea | null>(null);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [report, setReport] = useState<PointPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMetro, setShowMetro] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showPopulation, setShowPopulation] = useState(false);
  const [tpuFeatures, setTpuFeatures] = useState<HkTpuFeature[]>([]);
  const [popSummary, setPopSummary] = useState<{ total: number; young: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hk")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const feats = (d.population?.layer?.features ?? []) as HkTpuFeature[];
        setTpuFeatures(feats);
        setPopSummary(d.population?.summary ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = useCallback((p: Coordinate) => {
    setSelected(p);
    setSelectedStation(null);
    setSelectedArea(null);
    setAnalysisActive(false);
    setReport(null);
    setError("");
  }, []);

  const analyze = useCallback(async () => {
    if (!selected) return;
    setAnalysisActive(true);
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const r = await fetch(
        `/api/hk/point?lat=${selected.lat}&lng=${selected.lng}&radius=1`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "分析失败");
      setReport(d as PointPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const metroStations = useMemo<HkStation[]>(
    () => HK_LINES.flatMap((line) => line.stations),
    [],
  );

  // TPU 人口着色：按人口对数五级（浅到深），无人区灰。
  const tpuFill = useCallback((pop: number): string => {
    if (pop <= 0) return "#e2e8f0";
    if (pop < 20000) return "#dbeafe";
    if (pop < 40000) return "#93c5fd";
    if (pop < 80000) return "#3b82f6";
    if (pop < 150000) return "#1d4ed8";
    return "#1e3a8a";
  }, []);

  const tpuRings = useCallback((geo: HkTpuFeature["geometry"]): [number, number][][] => {
    const inner: number[][][] =
      geo.type === "Polygon"
        ? (geo.coordinates as number[][][])
        : (geo.coordinates as number[][][][]).flat();
    return inner.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* 顶部工具条 */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <h1 className="text-sm font-semibold">茶饮选址工作台</h1>
        <Badge variant="outline">{HK_MARKET_SOURCE.note}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={showAreas}
              onChange={(e) => setShowAreas(e.target.checked)}
              className="accent-emerald-600"
            />
            商圈示意
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={showMetro}
              onChange={(e) => setShowMetro(e.target.checked)}
              className="accent-sky-600"
            />
            港铁线路
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={showPopulation}
              onChange={(e) => setShowPopulation(e.target.checked)}
              className="accent-indigo-600"
            />
            人口图层
            {popSummary && <span className="text-xs text-muted-foreground">({(popSummary.total / 10000).toFixed(0)}万)</span>}
          </label>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左栏：商圈列表 + 分析面板 */}
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-muted/30 p-3">
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              香港商圈示意（{HK_AREAS.length}）
            </h2>
            <ul className="flex flex-col gap-1">
              {HK_AREAS.map((a) => {
                const active = selectedArea?.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-transparent hover:bg-card"
                      }`}
                      onClick={() => {
                        setSelectedArea(a);
                        setSelected(null);
                        setAnalysisActive(false);
                        setReport(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {a.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {a.en}
                          </span>
                        </span>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: HK_TYPE_COLOR[a.type] }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.region} · {a.type}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 点位分析 */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">点位分析</h2>
              {selected && (
                <span className="font-mono text-xs text-muted-foreground">
                  {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                </span>
              )}
            </div>
            {!selected && (
              <p className="text-xs text-muted-foreground">
                点击地图任意位置建立选点，再点「分析此位置」。
              </p>
            )}
            {selected && !analysisActive && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={analyze} disabled={busy}>
                  {busy ? "分析中…" : "分析此位置"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  清除
                </Button>
              </div>
            )}
            {analysisActive && report && (
              <div className="mt-1 flex flex-col gap-2 text-xs">
                <Section title="所在商圈示意">
                  {report.areasWithin.length === 0 ? (
                    <p className="text-muted-foreground">未落入任何示意商圈。</p>
                  ) : (
                    report.areasWithin.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: HK_TYPE_COLOR[a.type as keyof typeof HK_TYPE_COLOR] }}
                        />
                        {a.name}（{a.en}）· {a.type}
                      </div>
                    ))
                  )}
                </Section>
                <Section title="人口">
                  {report.population.estimate != null ? (
                    <div className="flex flex-col gap-0.5">
                      <p className="text-base font-semibold">
                        {report.population.estimate.toLocaleString()}
                        {report.population.tpu != null && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            （TPU {report.population.tpu} 常驻）
                          </span>
                        )}
                      </p>
                      <p>
                        年轻人口(15-44)：{" "}
                        <span className="font-medium">
                          {report.population.young?.toLocaleString() ?? "—"}
                        </span>
                      </p>
                      {report.population.source?.status === "real" && (
                        <p className="text-emerald-700">
                          ✓ 真实数据 · {report.population.source.actualSource ?? "2021人口普查"}
                        </p>
                      )}
                      <p className="text-muted-foreground">{report.population.method}</p>
                    </div>
                  ) : (
                    <p>{report.population.method}</p>
                  )}
                </Section>
                <Section title="交通">
                  <p>{report.transit.method}</p>
                </Section>
                <Section title="竞品">
                  <p>{report.competitors.note}</p>
                </Section>
                <Section title="结构判断">
                  <p>{report.structure.sentence}</p>
                </Section>
                <div className="rounded bg-amber-50 p-2 text-amber-800">
                  <p className="font-semibold">数据口径</p>
                  <p>
                    人口为 2021 人口普查真实数据（TPU 级）；商圈示意图（中心点+半径圆）与港铁线路为占位近似，客流/竞品待接入，不构成精确选址依据。
                  </p>
                </div>
              </div>
            )}
            {analysisActive && !report && !error && busy && (
              <p className="text-xs text-muted-foreground">加载中…</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </aside>

        {/* 地图 */}
        <main className="relative min-w-0 flex-1">
          <MapContainer
            center={HK_CENTER}
            zoom={12}
            minZoom={10}
            maxZoom={18}
            bounds={HK_BOUNDS}
            className="z-0 h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClick onPick={pick} />
            {showMetro &&
              HK_LINES.map((line) => (
                <Polyline
                  key={line.id}
                  positions={line.stations.map((s) => [s.lat, s.lng] as [number, number])}
                  pathOptions={{ color: line.color, weight: 4, opacity: 0.9 }}
                />
              ))}
            {showMetro &&
              metroStations
                .filter((s) => s.id !== selectedStation?.id)
                .map((s) => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lng]}
                    radius={5}
                    pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#334155", fillOpacity: 1 }}
                    eventHandlers={{
                      click: () => {
                        setSelectedStation(s);
                        pick({ lat: s.lat, lng: s.lng });
                        setAnalysisActive(false);
                        setReport(null);
                      },
                    }}
                  />
                ))}
            {showMetro && selectedStation && (
              <CircleMarker
                center={[selectedStation.lat, selectedStation.lng]}
                radius={7}
                pathOptions={{ color: "#0f172a", weight: 3, fillColor: "#38bdf8", fillOpacity: 1 }}
              />
            )}
            {showAreas &&
              HK_AREAS.map((a) => (
                <Circle
                  key={a.id}
                  center={[a.center.lat, a.center.lng]}
                  radius={a.radiusKm * 1000}
                  pathOptions={{
                    color: selectedArea?.id === a.id ? HK_TYPE_COLOR[a.type] : "#475569",
                    weight: selectedArea?.id === a.id ? 3 : 1.5,
                    dashArray: "6 4",
                    fillColor: HK_TYPE_COLOR[a.type],
                    fillOpacity: selectedArea?.id === a.id ? 0.12 : 0.05,
                  }}
                  eventHandlers={{ click: () => setSelectedArea(a) }}
                />
              ))}
            {showPopulation &&
              tpuFeatures.map((f) => (
                <Polygon
                  key={f.properties.tpu}
                  positions={tpuRings(f.geometry)}
                  pathOptions={{
                    color: "#475569",
                    weight: 0.6,
                    fillColor: tpuFill(f.properties.pop),
                    fillOpacity: f.properties.pop > 0 ? 0.55 : 0.15,
                    interactive: false,
                  }}
                />
              ))}
            {selected && (
              <>
                <Circle
                  center={[selected.lat, selected.lng]}
                  radius={1000}
                  pathOptions={{ color: "#b91c1c", weight: 2, dashArray: "4 4", fillColor: "#b91c1c", fillOpacity: 0.06 }}
                />
                <CircleMarker
                  center={[selected.lat, selected.lng]}
                  radius={6}
                  pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#b91c1c", fillOpacity: 1 }}
                />
              </>
            )}
          </MapContainer>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-semibold text-foreground">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}