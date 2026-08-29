import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost:3001',
    'localhost:3000',
    '127.0.0.1:3001',
    '127.0.0.1:3000',
    '192.168.1.213:3001',
    '192.168.1.213:3000',
    '*.local:3001',
    '*.local:3000'
  ]
};

export default nextConfig;
