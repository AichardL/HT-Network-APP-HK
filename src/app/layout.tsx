import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HT Network · 香港茶饮选址工作台',
    template: '%s · HT Network HK',
  },
  description:
    '香港门店选址工作台：2021 官方人口普查（TPU 级真实人口）、商圈示意、港铁线路与点位分析。',
  keywords: ['香港选址', '门店网络规划', '2021人口普查', 'TPU', '茶饮', '港铁'],
  openGraph: {
    title: 'HT Network · 香港茶饮选址工作台',
    description:
      '基于 2021 人口普查与规划署 TPU 边界的香港门店选址工作台，含真实人口图层、商圈示意与点位分析。',
    type: 'website',
    locale: 'zh_HK',
    siteName: 'HT Network · HK',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" suppressHydrationWarning>
      <body className={`antialiased`}>
        <noscript>
          <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>HT Network · 香港茶饮选址工作台</h1>
            <p>
              本站是交互式地图选址工具，需要启用 JavaScript 才能加载地图与数据。
            </p>
          </div>
        </noscript>
        <div className="sr-only" aria-label="站点说明">
          香港茶饮选址工作台：人口为 2021 官方普查真实数据；商圈与港铁线路为占位示意，不构成精确选址依据。
        </div>
        {children}
      </body>
    </html>
  );
}