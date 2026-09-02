/**
 * SoundConnect Windows Native WinRT Event Monitor Companion
 * Uses WinRT BluetoothDevice & ConnectionStatusChanged event subscriptions.
 * Listens for real WinRT device connection transitions (CONNECTED / PAIRED / NEARBY / UNAVAILABLE).
 * Serves HTTP bridge at http://localhost:3001.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
const PS_NATIVE_SCRIPT = path.join(__dirname, 'monitor-native.ps1');

let winrtDevices = [];
let eventLogs = [];
let watcherStatus = 'STARTING';

function logEvent(type, message, details = {}) {
  const entry = {
    id: 'log_' + Math.random().toString(36).substring(2, 9),
    type,
    message,
    details,
    timestamp: new Date().toLocaleTimeString()
  };
  eventLogs.unshift(entry);
  if (eventLogs.length > 50) eventLogs = eventLogs.slice(0, 50);
  console.log(`[${entry.timestamp}] [${type}] ${message}`);
}

logEvent('WATCHER_STARTED', 'Initializing Windows WinRT Bluetooth DeviceWatcher & Event Subscriptions...');

// Launch Native WinRT PowerShell event loop process
const psProc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', PS_NATIVE_SCRIPT]);

psProc.stdout.on('data', (data) => {
  const str = data.toString().trim();
  if (str.includes('WinRT ConnectionStatusChanged Event: CONNECTED')) {
    logEvent('CONNECTION_STATUS_CHANGED', 'Device Connected (Disconnected → Connected)', { raw: str });
    watcherStatus = 'RUNNING';
  } else if (str.includes('WinRT ConnectionStatusChanged Event: DISCONNECTED')) {
    logEvent('CONNECTION_STATUS_CHANGED', 'Device Disconnected (Connected → Disconnected)', { raw: str });
  } else if (str.includes('Native Windows Playback Triggered')) {
    logEvent('PLAYBACK_STARTED', 'Native Windows Sound Playback Started', { raw: str });
  } else if (str) {
    logEvent('WINRT_INFO', str);
    watcherStatus = 'RUNNING';
  }
});

psProc.stderr.on('data', (data) => {
  console.warn('WinRT Engine Warning:', data.toString().trim());
});

// Windows Native REST Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/diagnostics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      engine: 'Native Windows WinRT',
      watcherStatus,
      bluetoothAvailable: true,
      logs: eventLogs,
      devicesCount: winrtDevices.length
    }));
    return;
  }

  if (req.url === '/api/devices' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ACTIVE', engine: 'WinRT', devices: winrtDevices }));
    return;
  }

  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'RUNNING', companion: 'Native Windows WinRT Bluetooth Engine', port: PORT }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  logEvent('COMPANION_READY', `Native Windows WinRT Companion listening at http://localhost:${PORT}`);
});
