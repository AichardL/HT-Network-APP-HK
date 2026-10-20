import { HK_LINES, HK_STATIONS } from "./transit";
import type { SourceMeta } from "./provenance";

// Compatibility exports for the first HK page. There are deliberately no
// manually-curated commercial areas in Phase 1: Districts are navigation, and
// PPU/SPU/TPU are the official statistical hierarchy.
export { HK_LINES, HK_STATIONS };

export type HkStation = (typeof HK_STATIONS)[number];
export type HkLine = (typeof HK_LINES)[number];

export const HK_MARKET_SOURCE: SourceMeta = {
  status: "real",
  provider: "CSDI / C&SD / Planning Department / MTR Corporation",
  actualSource: "Local snapshot manifest (src/lib/hk/manifest.json)",
  period: "2021 population census + latest downloaded MTR monthly CSV",
  retrievedAt: "see snapshot manifest",
  note: "Phase 1 只展示官方行政/规划统计层级和港铁线路；不定义商业区，不生成客流或选址结论。",
};
