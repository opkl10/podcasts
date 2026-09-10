import type { NextConfig } from "next";

const isElectronBuild = process.env.BUILD_TARGET === 'electron';

const nextConfig: NextConfig = {
  // 'standalone' bundles server + dependencies for packaging inside Electron
  output: isElectronBuild ? 'standalone' : undefined,
  allowedDevOrigins: [
    'localhost:3001',
    'localhost:3000',
    '127.0.0.1:3001',
    '127.0.0.1:3000',
    '192.168.1.213:3001',
    '192.168.1.213:3000',
    '*.local:3001',
    '*.local:3000'
  ],
  async headers() {
    return [
      {
        // Allow camera/microphone/screen capture from localhost (Electron context)
        source: '/(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=*, microphone=*, display-capture=*' },
        ],
      },
    ];
  },
};

export default nextConfig;
