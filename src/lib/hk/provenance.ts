export type SourceMeta = {
  status: "real" | "unavailable";
  provider: string;
  actualSource?: string;
  period?: string;
  retrievedAt?: string;
  note?: string;
};

export type SnapshotDataset = SourceMeta & {
  id: string;
  featureCount?: number;
  checksum?: string;
  validation?: {
    passed: boolean;
    checks: string[];
    failures?: string[];
  };
};

export type SnapshotManifest = {
  schemaVersion: 1;
  generatedAt: string;
  datasets: SnapshotDataset[];
};

export const SOURCE_URLS = {
  csdi: "https://portal.csdi.gov.hk/csdi-webpage/doc/GeoSpatialServices",
  csdiDistricts:
    "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635932856094_19982&format=geojson&layer_name=DC_21C",
  csdiPlanningUnits:
    "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=pland_rcd_1634022783366_65050&format=geojson&layer_name=TPUSU_2021",
  csdiLargeSubunits:
    "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635933282224_58228&format=geojson&layer_name=LSUG_21C",
  csdiSmallSubunits:
    "https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=censtatd_rcd_1635933365202_19171&format=geojson&layer_name=SSUG_21C",
  locationSearch:
    "https://www.map.gov.hk/gs/api/v1.0.0/locationSearch",
  mtrHeavy:
    "https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv",
  mtrLight:
    "https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv",
  osmStationCoordinates:
    "https://overpass.kumi.systems/api/interpreter",
  osmCopyright: "https://www.openstreetmap.org/copyright",
} as const;

export const LOCAL_SNAPSHOT_NOTE =
  "页面只读取仓库内快照；同步失败时接口返回 unavailable，不生成代理数据。";
