import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [],
  allowedDevOrigins: ['*.dev.coze.site'],
};

export default nextConfig;