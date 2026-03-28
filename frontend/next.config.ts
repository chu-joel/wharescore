import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    // In Docker, nginx handles routing — these rewrites are for local dev only
    if (process.env.NEXT_PUBLIC_USE_PROXY === 'false') return [];
    return [
      { source: '/api/v1/:path*', destination: 'http://localhost:8000/api/v1/:path*' },
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
              // unsafe-inline needed for Next.js inline scripts; unsafe-eval only in dev
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://tile.openstreetmap.org https://basemaps.linz.govt.nz https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://lh3.googleusercontent.com",
              "font-src 'self' https://fonts.gstatic.com https://fonts.openmaptiles.org",
              "connect-src 'self' https://basemaps.linz.govt.nz https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://accounts.google.com https://tiles.openfreemap.org https://fonts.openmaptiles.org",
              "worker-src 'self' blob:",
              "frame-src https://accounts.google.com https://checkout.stripe.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
