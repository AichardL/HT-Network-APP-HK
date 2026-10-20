# HT Network · 香港茶饮选址工作台（独立 Web 应用）

香港门店选址独立 Web 应用，与新加坡工程完全解耦。

## 功能

- **地图工作台**：Leaflet + OpenStreetMap 香港底图，动态加载（`ssr:false`）。
- **商圈示意图层**：25 个商圈（中心点 + 半径圆，可按类型着色）。
- **港铁线路图层**：4 条主干线路（站点顺序 + 近似坐标）与站点点选。
- **点位分析**：点击地图 → 选点 → 「分析此位置」→ 返回点位所在 TPU 的**真实 2021 人口普查人口**。
- **人口图层开关**：TPU（三级规划单元）级真实人口着色多边形。

## 数据来源与口径（诚实标注）

| 维度 | 状态 | 来源 |
|------|------|------|
| 人口 | **real** | 2021 人口普查 LSG（政府统计处）聚合到 TPU；边界规划署 TPUSBVC_2021（EPSG:2326→WGS84） |
| 商圈示意图 | proxy | 中心点 + 半径圆的占位示意，坐标近似 |
| 港铁线路 | proxy | 线路主干站点顺序 + 近似坐标 |
| 客流 / 竞品 | 待接入 | 未接通港铁客流、Google Places 竞品 |

**人口为真实官方数据；商圈 / 港铁坐标为占位示意，不构成精确选址依据。**

API：`GET /api/hk`（商圈 + 地铁 + TPU 人口图层 + summary）、`GET /api/hk/point?lat&lng&radius`（点位所在 TPU 真实人口）。

## 技术栈

- Next.js 16（App Router）、React 19、TypeScript strict
- Tailwind CSS 4、shadcn/ui（仅 Button / Badge）
- react-leaflet 5 + Leaflet、@turf/boolean-point-in-polygon

## 本地运行

```bash
pnpm install
pnpm dev        # http://localhost:5000
pnpm build      # 生产构建
pnpm start      # 生产运行
```

> 仅允许 pnpm。要求 Node >= 24.5。