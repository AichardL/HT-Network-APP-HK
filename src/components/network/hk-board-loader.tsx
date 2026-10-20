'use client';
import dynamic from 'next/dynamic';

// react-leaflet 依赖浏览器 DOM，必须 ssr:false 动态加载，否则 SSG/SSR 崩溃。
const HkBoard = dynamic(() => import('./hk-board'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground">
      载入香港地图…
    </div>
  ),
});

export default function HkBoardLoader() {
  return <HkBoard />;
}