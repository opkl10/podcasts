import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;

      for (const info of netInterface) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (info.family === 'IPv4' && !info.internal) {
          // Prefer typical Wi-Fi / Ethernet interface ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          localIp = info.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }

    return NextResponse.json({
      ip: localIp,
      hostname: os.hostname(),
      status: 'ok'
    });
  } catch (err: any) {
    return NextResponse.json({ ip: '127.0.0.1', error: err.message }, { status: 500 });
  }
}
