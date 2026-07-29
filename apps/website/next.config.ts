import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  turbopack: {
    root: '../..',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
