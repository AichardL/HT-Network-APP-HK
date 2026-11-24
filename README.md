# HT Network · 香港网归地图底座（Phase 1）

香港独立 Web 应用，当前阶段只实现公开只读的地图探索与官方空间统计底座。它沿用新加坡系统的边界：`browse → light-pick → future analyzing`；Phase 1 不执行 Trade Area、评分、候选比较、综合排名或权限工作区。

## 已实现

- OSM 基础底图。
- 18 区导航层，以及 CSDI / 2021 人口普查的 PPU、SPU、TPU 统计层级。
- 2021 人口分区图层可在主要屋苑（540 个）、PPU（9 区）、SPU（52 区）、TPU（292 区）之间切换；PPU / SPU 边界由官方 TPU 边界和层级关系聚合生成，人口为所属 TPU 之和。
- 点选任意位置后，可选择 0.5 / 1 / 2 / 3 km 半径查看“周边 TPU 覆盖人口近似值”，结果会明确列出所在 TPU 编码及纳入计算的 TPU 编码；并按 District / PPU / SPU 展开汇总。
- 港铁重铁、轻铁分开显示；线路和站点来自 MTR 官方开放 CSV。
- 港铁站点坐标在同步期通过 Lands Department Location Search API / OpenStreetMap 进行对接，并在 manifest 中记录来源和校验结果。
- 官方地址 / 地名搜索服务端代理：`GET /api/hk/search?q=...`。搜索只负责定位。
- 本地快照优先：页面运行时不请求 CSDI、MTR 或 OSM 数据源；外部服务不可用时不会生成假数据。

## API

- `GET /api/hk`：地图边界、人口、重铁 / 轻铁、来源 manifest 和 Phase 1 能力边界。
- `GET /api/hk/point?lat=...&lng=...&radiusKm=1`：识别 District / PPU / SPU / TPU、最近站点，以及指定半径内的 TPU 覆盖人口近似值和纳入计算的 TPU 编码。
- `GET /api/hk/search?q=...`：服务端代理官方 Location Search API，并把 HK80 坐标转换为 WGS84。

所有公开接口都是只读 GET；不接受写入、不保存用户位置、不需要登录。

## 官方来源

| 图层 | 来源 | 用途 |
| --- | --- | --- |
| 行政 / 规划边界 | [CSDI GeoSpatial Services](https://portal.csdi.gov.hk/csdi-webpage/doc/GeoSpatialServices)；CSDI file API 快照 | 地图叠加、空间层级识别 |
| 人口 | [2021 Population Census](https://www.censtatd.gov.hk/en/data/stat_report/product/B1120110/att/B11201102021XXXXB0100.pdf)；[Major Housing Estates boundaries](https://portal.csdi.gov.hk/csdi-webpage/dataset/censtatd_rcd_1695182015782_79001) | District / 主要屋苑 / PPU / SPU / TPU 统计卡片、层级着色和半径汇总 |
| 重铁 / 轻铁 | [MTR routes, fares and barrier-free facilities](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities) | 线路、站点顺序和站点卡片 |
| 地址搜索 | [CSDI Location Search API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) | 官方定位搜索 |
| 基础底图 | [OpenStreetMap](https://www.openstreetmap.org/copyright) | OSM 地图底图和站点坐标冗余匹配 |

## 快照同步与校验

```bash
pnpm install
pnpm sync:hk
pnpm validate:hk
```

`scripts/sync-hk.mjs` 会下载 MTR 重铁 / 轻铁 CSV、站点坐标源，执行字段、顺序、重复站点、坐标匹配校验，并生成：

- `src/lib/hk/transit.json`
- `src/lib/hk/manifest.json`
- `data/hk/raw/` 原始下载文件

行政 / 规划边界快照与人口快照同样必须带有来源 URL、提供机构、统计期 / 数据日期、下载时间、要素数量、校验结果和失败原因。不能完成同步时，应保留旧快照并把本次失败写入 manifest；不得用 proxy 数据替代。

## 本地运行

```bash
pnpm dev        # http://localhost:5000
pnpm ts-check
pnpm lint
pnpm build
```

要求 Node >= 24.5，包管理器使用 pnpm。
