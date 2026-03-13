import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // In Docker, nginx handles routing — these rewrites are for local dev only
    if (process.env.NEXT_PUBLIC_USE_PROXY === 'false') return [];
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
      { source: '/tiles/:path*', destination: 'http://localhost:3001/:path*' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://tile.openstreetmap.org https://basemaps.linz.govt.nz https://*.basemaps.cartocdn.com https://server.arcgisonline.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://basemaps.linz.govt.nz https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com",
              "worker-src 'self' blob:",
              "frame-src https://www.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
