async function parseResponse(res) {
  let json;

  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: invalid JSON response`);
  }

  if (!res.ok || json.status !== 1) {
    const errors =
      json?.errors
        ? JSON.stringify(json.errors)
        : json?.error || json?.message || `HTTP ${res.status}`;

    throw new Error(errors);
  }

  return json;
}

async function login(email, password, twofa) {
  const body = new URLSearchParams({
    email,
    password
  });

  if (twofa) {
    body.set('twofa', twofa);
  }

  const res = await fetch('https://api.pushover.net/1/users/login.json', {
    method: 'POST',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    },
    body
  });

  const json = await parseResponse(res);

  return {
    userKey: json.id,
    secret: json.secret
  };
}

async function registerDevice(secret, deviceName) {
  const body = new URLSearchParams({
    secret,
    name: deviceName,
    os: 'O'
  });

  const res = await fetch('https://api.pushover.net/1/devices.json', {
    method: 'POST',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    },
    body
  });

  const json = await parseResponse(res);

  return json.id;
}

async function fetchMessages(secret, deviceId) {
  const url = new URL('https://api.pushover.net/1/messages.json');
  url.searchParams.set('secret', secret);
  url.searchParams.set('device_id', deviceId);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    }
  });

  const json = await parseResponse(res);
  return json.messages || [];
}

async function deleteUpTo(secret, deviceId, highestMessageId) {
  const body = new URLSearchParams({
    secret,
    message: String(highestMessageId)
  });

  const res = await fetch(
    `https://api.pushover.net/1/devices/${deviceId}/update_highest_message.json`,
    {
      method: 'POST',
      headers: {
        'User-Agent': 'PushoverOpenClientElectron/0.1'
      },
      body
    }
  );

  const json = await parseResponse(res);
  return json;
}

const WebSocket = require('ws');

async function parseResponse(res) {
  let json;

  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: invalid JSON response`);
  }

  if (!res.ok || json.status !== 1) {
    const errors =
      json?.errors
        ? JSON.stringify(json.errors)
        : json?.error || json?.message || `HTTP ${res.status}`;

    throw new Error(errors);
  }

  return json;
}

async function login(email, password, twofa) {
  const body = new URLSearchParams({
    email,
    password
  });

  if (twofa) {
    body.set('twofa', twofa);
  }

  const res = await fetch('https://api.pushover.net/1/users/login.json', {
    method: 'POST',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    },
    body
  });

  const json = await parseResponse(res);

  return {
    userKey: json.id,
    secret: json.secret
  };
}

async function registerDevice(secret, deviceName) {
  const body = new URLSearchParams({
    secret,
    name: deviceName,
    os: 'O'
  });

  const res = await fetch('https://api.pushover.net/1/devices.json', {
    method: 'POST',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    },
    body
  });

  const json = await parseResponse(res);

  return json.id;
}

async function fetchMessages(secret, deviceId) {
  const url = new URL('https://api.pushover.net/1/messages.json');
  url.searchParams.set('secret', secret);
  url.searchParams.set('device_id', deviceId);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'PushoverOpenClientElectron/0.1'
    }
  });

  const json = await parseResponse(res);
  return json.messages || [];
}

async function deleteUpTo(secret, deviceId, highestMessageId) {
  const body = new URLSearchParams({
    secret,
    message: String(highestMessageId)
  });

  const res = await fetch(
    `https://api.pushover.net/1/devices/${deviceId}/update_highest_message.json`,
    {
      method: 'POST',
      headers: {
        'User-Agent': 'PushoverOpenClientElectron/0.1'
      },
      body
    }
  );

  const json = await parseResponse(res);
  return json;
}

function connectRealtime({ secret, deviceId, onSync, onReconnect, onFatal, onLog }) {
  const ws = new WebSocket('wss://client.pushover.net/push');

  ws.on('open', () => {
    const loginLine = `login:${deviceId}:${secret}\n`;
    ws.send(loginLine);
    onLog?.('WebSocket connected');
  });

  ws.on('message', async (data) => {
    const frame = data.toString('utf8');
    onLog?.(`WS frame: ${JSON.stringify(frame)}`);

    if (frame === '#') {
      return;
    }

    if (frame === '!') {
      try {
        await onSync?.();
      } catch (err) {
        onLog?.(`sync error: ${err.message}`);
      }
      return;
    }

    if (frame === 'R') {
      onReconnect?.('server requested reconnect');
      ws.close();
      return;
    }

    if (frame === 'E' || frame === 'A') {
      onFatal?.(frame);
      ws.close();
      return;
    }
  });

  ws.on('error', (err) => {
    onLog?.(`ws error: ${err.message}`);
  });

  ws.on('close', () => {
    onLog?.('WebSocket closed');
  });

  return ws;
}

module.exports = {
  login,
  registerDevice,
  fetchMessages,
  deleteUpTo,
  connectRealtime
};