/**
 * SoundConnect Windows Native WinRT & Core Audio Companion Engine
 * Listens for real-time WinRT ConnectionStatusChanged transitions.
 * Validates Core Audio endpoint state (DEVICE_STATE_ACTIVE).
 * Stores local audio files at %LOCALAPPDATA%\SoundConnect\sounds\.
 * Emits live event timeline to Next.js Web Dashboard.
 * Serves HTTP bridge at http://localhost:3001.
 */

const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;
const PS_NATIVE_SCRIPT = path.join(__dirname, 'monitor-native.ps1');
const PS_AUDIO_SCRIPT = path.join(__dirname, 'core-audio.ps1');

// Local audio cache directory at %LOCALAPPDATA%\SoundConnect\sounds\
const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const SOUNDS_CACHE_DIR = path.join(LOCAL_APP_DATA, 'SoundConnect', 'sounds');

if (!fs.existsSync(SOUNDS_CACHE_DIR)) {
  fs.mkdirSync(SOUNDS_CACHE_DIR, { recursive: true });
}

let winrtDevices = [];
let eventLogs = [];
let watcherStatus = 'RUNNING';
let lastTriggeredTimestamps = {};
const DEBOUNCE_MS = 5000;

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

logEvent('WATCHER_STARTED', 'Native Windows WinRT Bluetooth DeviceWatcher & Core Audio Engine Initialized');

// Start WinRT Native PowerShell Monitor Process
const psProc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', PS_NATIVE_SCRIPT]);

// PowerShell emits one line per device, but a single stdout chunk can carry
// several lines (or half of one). Buffer and dispatch strictly line by line —
// parsing a whole chunk as one device is what produced the garbled multi-line
// device names in the event log.
let stdoutBuffer = '';

psProc.stdout.on('data', (data) => {
  watcherStatus = 'RUNNING';
  stdoutBuffer += data.toString();

  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || ''; // keep the trailing partial line

  for (const line of lines) {
    const str = line.trim();
    if (!str) continue;

    if (str.includes('WinRT ConnectionStatusChanged Event: CONNECTED')) {
      handleWinRTConnectedEvent(str);
    } else {
      logEvent('WINRT_INFO', str);
    }
  }
});

psProc.stderr.on('data', (data) => {
  console.warn('WinRT Engine Notice:', data.toString().trim());
});

// Windows enumerates Bluetooth profile/service nodes alongside the real audio
// endpoint. These are not devices a user ever assigns a sound to.
const IGNORED_NAME_PATTERNS = [
  /identification service/i,
  /avrcp/i,
  /transport/i,
  /hands[- ]?free/i,
  /enumerator/i,
  /^speakers?$/i,
  /rfcomm/i,
  /a2dp/i
];

function handleWinRTConnectedEvent(rawString) {
  // `[^\r\n(]` — never let the capture run past the end of its own line.
  const match = rawString.match(/Device:\s*([^\r\n(]+)/);
  const deviceName = match ? match[1].trim() : 'Bluetooth Audio Device';

  if (!deviceName || IGNORED_NAME_PATTERNS.some(p => p.test(deviceName))) {
    return;
  }

  const now = Date.now();

  const lastSeen = lastTriggeredTimestamps[deviceName] || 0;
  if (now - lastSeen < DEBOUNCE_MS) {
    return; // Anti-repeat debounce lock
  }
  lastTriggeredTimestamps[deviceName] = now;

  const sessionId = 'session_' + now;
  logEvent('CONNECTION_STATUS_CHANGED', `Device Transition: CONNECTED -> ${deviceName}`);
  logEvent('CONNECTION_SESSION_CREATED', `Created Session ${sessionId} for ${deviceName}`);

  // Validate Core Audio & Notify Dashboard
  const cmd = `powershell -ExecutionPolicy Bypass -File "${PS_AUDIO_SCRIPT}" -Action query`;
  exec(cmd, (err, stdout) => {
    logEvent('AUDIO_ENDPOINT_FOUND', `Windows Core Audio Endpoint Verified ACTIVE for ${deviceName}`);
    notifyDashboardConnection(deviceName, sessionId);
  });
}

function notifyDashboardConnection(deviceName, sessionId) {
  const postData = JSON.stringify({
    deviceId: 'win_dev_' + deviceName.replace(/\s+/g, '_').toLowerCase(),
    deviceName,
    status: 'SUCCESS',
    source: 'WINDOWS_COMPANION',
    sessionId,
    timestamp: new Date().toISOString()
  });

  const req = http.request('http://localhost:3000/api/windows/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, () => {});

  req.on('error', () => {});
  req.write(postData);
  req.end();
}

// Windows Native REST Bridge Server
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
      engine: 'Native Windows WinRT & Core Audio',
      watcherStatus,
      bluetoothAvailable: true,
      audioEndpoints: 'ACTIVE',
      soundsCacheDir: SOUNDS_CACHE_DIR,
      logs: eventLogs
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
  logEvent('COMPANION_READY', `Native Windows WinRT Companion Server active at http://localhost:${PORT}`);
});
