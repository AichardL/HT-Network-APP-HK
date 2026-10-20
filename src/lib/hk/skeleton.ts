// 香港布局骨架（占位数据，非真实接入）。
// 商圈为中心点 + 示意半径圆，坐标仅到街区级近似；港铁为线路主干站点顺序示意，
// 站点坐标近似。均不构成精确地理边界。真实数据（规划署/港铁/政府统计处 GIS、客流、
// 边界）待后续接入，接入后用诚实 provenance 标注 status=real 并替换本文件。

export type HkAreaType =
  | "核心商业"
  | "办公"
  | "社区"
  | "旅游"
  | "大学";

export type HkAreaRegion = "香港岛" | "九龙" | "新界";

export type HkArea = {
  id: string;
  name: string; // 中文名（英文名在英文栏）
  en: string;
  region: HkAreaRegion;
  type: HkAreaType;
  center: { lat: number; lng: number };
  radiusKm: number;
};

export type HkStation = {
  id: string;
  name: string;
  en: string;
  lat: number;
  lng: number;
};

export type HkLine = {
  id: string;
  name: string;
  en: string;
  color: string;
  stations: HkStation[];
};

export const HK_MARKET_SOURCE = {
  status: "proxy" as const,
  note: "占位示意 · 坐标近似 · 待接入香港真实数据",
};

export const HK_AREAS: HkArea[] = [
  // 香港岛
  { id: "central", name: "中环", en: "Central", region: "香港岛", type: "核心商业", center: { lat: 22.2874, lng: 114.1391 }, radiusKm: 1.0 },
  { id: "sheungwan", name: "上环", en: "Sheung Wan", region: "香港岛", type: "办公", center: { lat: 22.286, lng: 114.151 }, radiusKm: 0.7 },
  { id: "wanchai", name: "湾仔", en: "Wan Chai", region: "香港岛", type: "办公", center: { lat: 22.2766, lng: 114.1727 }, radiusKm: 0.8 },
  { id: "cwb", name: "铜锣湾", en: "Causeway Bay", region: "香港岛", type: "核心商业", center: { lat: 22.2802, lng: 114.1855 }, radiusKm: 0.8 },
  { id: "northpoint", name: "北角", en: "North Point", region: "香港岛", type: "社区", center: { lat: 22.291, lng: 114.2 }, radiusKm: 0.8 },
  { id: "taikoo", name: "太古", en: "Tai Koo", region: "香港岛", type: "社区", center: { lat: 22.285, lng: 114.215 }, radiusKm: 0.8 },
  { id: "aberdeen", name: "香港仔", en: "Aberdeen", region: "香港岛", type: "社区", center: { lat: 22.2518, lng: 114.1547 }, radiusKm: 0.8 },
  { id: "hku", name: "港大", en: "HKU", region: "香港岛", type: "大学", center: { lat: 22.283, lng: 114.136 }, radiusKm: 0.6 },
  // 九龙
  { id: "tst", name: "尖沙咀", en: "Tsim Sha Tsui", region: "九龙", type: "旅游", center: { lat: 22.2977, lng: 114.1722 }, radiusKm: 0.9 },
  { id: "jordan", name: "佐敦", en: "Jordan", region: "九龙", type: "社区", center: { lat: 22.305, lng: 114.172 }, radiusKm: 0.7 },
  { id: "ymt", name: "油麻地", en: "Yau Ma Tei", region: "九龙", type: "社区", center: { lat: 22.312, lng: 114.1705 }, radiusKm: 0.7 },
  { id: "mongkok", name: "旺角", en: "Mong Kok", region: "九龙", type: "核心商业", center: { lat: 22.319, lng: 114.169 }, radiusKm: 0.9 },
  { id: "shamshuipo", name: "深水埗", en: "Sham Shui Po", region: "九龙", type: "社区", center: { lat: 22.335, lng: 114.162 }, radiusKm: 0.9 },
  { id: "kowloontong", name: "九龙塘", en: "Kowloon Tong", region: "九龙", type: "大学", center: { lat: 22.3376, lng: 114.175 }, radiusKm: 0.8 },
  { id: "kowloonbay", name: "九龙湾", en: "Kowloon Bay", region: "九龙", type: "办公", center: { lat: 22.324, lng: 114.214 }, radiusKm: 0.8 },
  { id: "kwuntong", name: "观塘", en: "Kwun Tong", region: "九龙", type: "社区", center: { lat: 22.3168, lng: 114.2255 }, radiusKm: 0.9 },
  // 新界
  { id: "shatin", name: "沙田", en: "Sha Tin", region: "新界", type: "社区", center: { lat: 22.379, lng: 114.189 }, radiusKm: 1.2 },
  { id: "cuhk", name: "中大", en: "CUHK", region: "新界", type: "大学", center: { lat: 22.419, lng: 114.207 }, radiusKm: 0.8 },
  { id: "tsuenwan", name: "荃湾", en: "Tsuen Wan", region: "新界", type: "社区", center: { lat: 22.3707, lng: 114.1135 }, radiusKm: 1.2 },
  { id: "kwaitong", name: "葵芳", en: "Kwai Fong", region: "新界", type: "社区", center: { lat: 22.357, lng: 114.128 }, radiusKm: 1.0 },
  { id: "tuenmun", name: "屯门", en: "Tuen Mun", region: "新界", type: "社区", center: { lat: 22.392, lng: 113.973 }, radiusKm: 1.2 },
  { id: "yeunlong", name: "元朗", en: "Yuen Long", region: "新界", type: "社区", center: { lat: 22.444, lng: 114.026 }, radiusKm: 1.0 },
  { id: "taipo", name: "大埔", en: "Tai Po", region: "新界", type: "社区", center: { lat: 22.45, lng: 114.168 }, radiusKm: 1.0 },
  { id: "sheungshui", name: "上水", en: "Sheung Shui", region: "新界", type: "社区", center: { lat: 22.502, lng: 114.13 }, radiusKm: 1.0 },
  { id: "tko", name: "将军澳", en: "Tseung Kwan O", region: "新界", type: "社区", center: { lat: 22.306, lng: 114.256 }, radiusKm: 1.0 },
  { id: "tungchung", name: "东涌", en: "Tung Chung", region: "新界", type: "社区", center: { lat: 22.288, lng: 113.943 }, radiusKm: 1.0 },
];

// 港铁主干线路骨架（站点为行车先后顺序示意 + 近似坐标，非完整站点清单）。
const S = (
  id: string,
  name: string,
  en: string,
  lat: number,
  lng: number,
): HkStation => ({ id, name, en, lat, lng });

export const HK_LINES: HkLine[] = [
  {
    id: "island",
    name: "港岛线",
    en: "Island Line",
    color: "#007cc3",
    stations: [
      S("kennedy", "坚尼地城", "Kennedy Town", 22.282, 114.128),
      S("hku-s", "香港大学", "HKU", 22.283, 114.136),
      S("sheungwan-s", "上环", "Sheung Wan", 22.286, 114.151),
      S("central-s", "中环", "Central", 22.2819, 114.1581),
      S("admiralty-s", "金钟", "Admiralty", 22.2786, 114.165),
      S("wanchai-s", "湾仔", "Wan Chai", 22.2766, 114.1727),
      S("cwb-s", "铜锣湾", "Causeway Bay", 22.2802, 114.1855),
      S("tinhau", "天后", "Tin Hau", 22.283, 114.191),
      S("northpoint-s", "北角", "North Point", 22.291, 114.2),
      S("taikoo-s", "太古", "Tai Koo", 22.285, 114.215),
      S("shaukeiwan", "筲箕湾", "Shau Kei Wan", 22.278, 114.232),
    ],
  },
  {
    id: "tsuenwan",
    name: "荃湾线",
    en: "Tsuen Wan Line",
    color: "#e2231a",
    stations: [
      S("tsuenwan-s", "荃湾", "Tsuen Wan", 22.3707, 114.1135),
      S("kwaihing", "葵兴", "Kwai Hing", 22.361, 114.13),
      S("kwaifong-s", "葵芳", "Kwai Fong", 22.357, 114.128),
      S("meifoo", "美孚", "Mei Foo", 22.338, 114.139),
      S("laichikok", "荔枝角", "Lai Chi Kok", 22.339, 114.148),
      S("cheungshawan", "长沙湾", "Cheung Sha Wan", 22.337, 114.155),
      S("shamshuipo-s", "深水埗", "Sham Shui Po", 22.33, 114.162),
      S("princeedward", "太子", "Prince Edward", 22.325, 114.168),
      S("mongkok-s", "旺角", "Mong Kok", 22.319, 114.169),
      S("ymt-s", "油麻地", "Yau Ma Tei", 22.312, 114.1705),
      S("jordan-s", "佐敦", "Jordan", 22.305, 114.172),
      S("tst-s", "尖沙咀", "Tsim Sha Tsui", 22.2977, 114.1722),
      S("admiralty-tw", "金钟", "Admiralty", 22.2786, 114.165),
      S("central-tw", "中环", "Central", 22.2819, 114.1581),
    ],
  },
  {
    id: "kwuntong",
    name: "观塘线",
    en: "Kwun Tong Line",
    color: "#00a54f",
    stations: [
      S("whampoa", "黄埔", "Whampoa", 22.305, 114.19),
      S("kwuntong-s", "观塘", "Kwun Tong", 22.3168, 114.2255),
      S("ngautaukok", "牛头角", "Ngau Tau Kok", 22.319, 114.219),
      S("kowloonbay-s", "九龙湾", "Kowloon Bay", 22.324, 114.214),
      S("choihung", "彩虹", "Choi Hung", 22.335, 114.209),
      S("diamondhill", "钻石山", "Diamond Hill", 22.34, 114.201),
      S("wongtaisin", "黄大仙", "Wong Tai Sin", 22.343, 114.196),
      S("lokfu", "乐富", "Lok Fu", 22.338, 114.186),
      S("kowloontong-s", "九龙塘", "Kowloon Tong", 22.3376, 114.175),
    ],
  },
  {
    id: "eastrail",
    name: "东铁线",
    en: "East Rail Line",
    color: "#53b7e8",
    stations: [
      S("admiralty-er", "金钟", "Admiralty", 22.2786, 114.165),
      S("exhibition", "会展", "Exhibition Centre", 22.283, 114.175),
      S("hunghom", "红磡", "Hung Hom", 22.303, 114.182),
      S("mongkokeast", "旺角东", "Mong Kok East", 22.321, 114.173),
      S("kowloontong-er", "九龙塘", "Kowloon Tong", 22.3376, 114.175),
      S("taiwai", "大围", "Tai Wai", 22.373, 114.178),
      S("shatin-er", "沙田", "Sha Tin", 22.379, 114.189),
      S("taipo-er", "大埔墟", "Tai Po Market", 22.445, 114.17),
      S("sheungshui-er", "上水", "Sheung Shui", 22.502, 114.13),
    ],
  },
];

// 商圈类型 → 配色（汇报/骨架示意用，不污染系统 SG 配色）。
export const HK_TYPE_COLOR: Record<HkAreaType, string> = {
  核心商业: "#b91c1c",
  办公: "#7c3aed",
  社区: "#047857",
  旅游: "#d97706",
  大学: "#0e7490",
};