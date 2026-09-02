/**
 * SoundConnect Windows Companion Node.js Engine
 * Runs at http://localhost:3001
 * Discovers real Windows Bluetooth audio devices and monitors connection events.
 */

const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = 3001;
const PS_SCRIPT = path.join(__dirname, 'bridge.ps1');

let windowsDevices = [];
let lastConnectionTimestamps = {};
const DEBOUNCE_COOLDOWN_MS = 5000;

function scanWindowsDevices() {
  const cmd = `powershell -ExecutionPolicy Bypass -File "${PS_SCRIPT}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('Windows Bluetooth Query Error:', err);
      return;
    }
    try {
      const parsed = JSON.parse(stdout.trim());
      if (Array.isArray(parsed)) {
        windowsDevices = parsed.map(d => ({
          id: d.id,
          name: d.name || 'Windows Bluetooth Device',
          category: inferCategory(d.name),
          connectionSource: 'windows',
          status: d.status || 'Connected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }));

        // Detect newly connected Windows Bluetooth Audio devices
        windowsDevices.forEach(device => {
          if (device.status === 'Connected') {
            const now = Date.now();
            const lastSeen = lastConnectionTimestamps[device.id] || 0;
            if (now - lastSeen > DEBOUNCE_COOLDOWN_MS) {
              lastConnectionTimestamps[device.id] = now;
              notifyConnectionEvent(device);
            }
          }
        });
      }
    } catch (e) {
      // Ignore JSON parse warning if output is empty
    }
  });
}

function inferCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('airp') || n.includes('buds') || n.includes('airdopes') || n.includes('ear')) return 'earbuds';
  if (n.includes('wh-') || n.includes('headphone') || n.includes('headset')) return 'headphones';
  if (n.includes('speaker') || n.includes('flip') || n.includes('jbl')) return 'speaker';
  if (n.includes('car') || n.includes('audio')) return 'car';
  return 'other';
}

function notifyConnectionEvent(device) {
  console.log(`🟢 Windows Bluetooth Audio Connected: ${device.name}`);
  const postData = JSON.stringify({
    deviceId: device.id,
    deviceName: device.name,
    status: 'SUCCESS',
    source: 'WINDOWS_COMPANION',
    timestamp: new Date().toISOString()
  });

  const req = http.request('http://localhost:3000/api/windows/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    // Event recorded
  });

  req.on('error', (e) => {
    // Web app not reachable yet
  });

  req.write(postData);
  req.end();
}

// Poll Windows PnP Bluetooth state every 3 seconds
setInterval(scanWindowsDevices, 3000);
scanWindowsDevices();

// Windows Companion Local REST Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/devices' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', devices: windowsDevices }));
    return;
  }

  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'RUNNING', companion: 'Windows Native Bluetooth Engine', port: PORT }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`✅ SoundConnect Windows Native Companion listening on http://localhost:${PORT}`);
});
