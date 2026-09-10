/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.podcaststudio.app',
  productName: 'Podcast Studio',
  copyright: 'Copyright © 2025 Podcast Studio',
  
  // Files to include in the package
  files: [
    'electron/dist/**',
    '.next/**',
    'public/**',
    'node_modules/**',
    'package.json',
    'next.config.ts',
    'tsconfig.json',
    'postcss.config.mjs',
    // Exclude heavy dev-only stuff
    '!node_modules/.cache',
    '!node_modules/electron',
    '!node_modules/electron-builder',
    '!.next/cache',
    '!**/.git/**',
    '!**/node_modules/.bin/electron*',
  ],
  
  // macOS-specific config
  mac: {
    category: 'public.app-category.video',
    icon: 'public/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'electron/entitlements.mac.plist',
    entitlementsInherit: 'electron/entitlements.mac.plist',
    target: [
      { target: 'dmg', arch: ['arm64'] },
    ],
  },
  
  // DMG installer appearance
  dmg: {
    title: 'Podcast Studio',
    icon: 'public/icon.icns',
    background: 'public/dmg-background.png',
    window: { width: 600, height: 400 },
    contents: [
      { x: 150, y: 200, type: 'file' },
      { x: 450, y: 200, type: 'link', path: '/Applications' },
    ],
  },
  
  // Output directory
  directories: {
    output: 'dist-electron',
    buildResources: 'public',
  },
};

module.exports = config;
