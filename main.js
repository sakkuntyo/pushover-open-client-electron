const { app, Tray, Menu, BrowserWindow, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { loadConfig, saveConfig } = require('./store');
const { login, registerDevice, fetchMessages, deleteUpTo, connectRealtime } = require('./pushover');

let tray = null;
let settingsWindow = null;
let realtimeSocket = null;
let reconnectTimer = null;
let reconnectDelayMs = 3000;

function getDataFilePath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    autoHideMenuBar: true,
    title: 'Pushover Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function showTestNotification() {
  const notification = new Notification({
    title: 'Pushover Client',
    body: 'Tray 常駐は動いています。'
  });

  notification.show();
}

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);

  fs.appendFileSync(
    getDataFilePath('realtime.log'),
    line + '\n',
    'utf8'
  );
}

async function syncMessagesOnce() {
  try {
    const config = loadConfig();

    if (!config.secret || !config.deviceId) {
      new Notification({
        title: 'Pushover Client',
        body: 'secret または deviceId が未保存です'
      }).show();
      return;
    }

    const messages = await fetchMessages(config.secret, config.deviceId);

    fs.writeFileSync(
      getDataFilePath('last-messages.json'),
      JSON.stringify(messages, null, 2),
      'utf8'
    );

    if (messages.length === 0) {
      new Notification({
        title: 'Pushover Client',
        body: '未読メッセージはありません'
      }).show();
      return;
    }

    const first = messages[0];
    const title = first.title || first.app || 'Pushover';
    const body = first.message || '(no body)';

    new Notification({
      title: `[${messages.length}件] ${title}`,
      body
    }).show();

    const highestIdStr = messages.reduce((max, msg) => {
      const current = BigInt(msg.id_str || String(msg.id));
      return current > max ? current : max;
    }, 0n).toString();

    await deleteUpTo(config.secret, config.deviceId, highestIdStr);

    fs.writeFileSync(
      getDataFilePath('last-delete.txt'),
      `deleted up to: ${highestIdStr}`,
      'utf8'
    );
  } catch (error) {
    fs.writeFileSync(
      getDataFilePath('last-error.txt'),
      String(error && error.stack ? error.stack : error),
      'utf8'
    );
    new Notification({
      title: 'Pushover Client',
      body: `同期失敗: ${error.message}`
    }).show();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');

  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = nativeImage.createEmpty();
    console.warn(`icon.png not found: ${iconPath}`);
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Pushover Open Client');

const contextMenu = Menu.buildFromTemplate([
  {
    label: '設定',
    click: () => createSettingsWindow()
  },
  {
    label: '今すぐ同期',
    click: async () => {
      try {
        await syncMessagesOnce();
      } catch (error) {
        console.error('sync failed:', error);
        new Notification({
          title: 'Pushover Client',
          body: `同期失敗: ${error.message}`
        }).show();
      }
    }
  },
  {
    label: '再接続',
    click: () => {
      reconnectDelayMs = 3000;
      startRealtimeIfConfigured();
    }
  },
  {
    label: 'テスト通知',
    click: () => showTestNotification()
  },
  { type: 'separator' },
  {
    label: '終了',
    click: () => app.quit()
  }
]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    createSettingsWindow();
  });
}

function setupIpc() {
  ipcMain.handle('settings:load-config', async () => {
    try {
      const config = loadConfig();
      return {
        ok: true,
        config: {
          email: config.email || '',
          deviceName: config.deviceName || ''
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('settings:login-and-save', async (_event, payload) => {
    try {
      const email = String(payload?.email || '').trim();
      const password = String(payload?.password || '');
      const deviceName = String(payload?.deviceName || '').trim();
      const twofa = String(payload?.twofa || '').trim();

      if (!email) {
        throw new Error('email is required');
      }
      if (!password) {
        throw new Error('password is required');
      }
      if (!deviceName) {
        throw new Error('deviceName is required');
      }

      const loginResult = await login(email, password, twofa);
      const deviceId = await registerDevice(loginResult.secret, deviceName);

      const config = {
        email,
        userKey: loginResult.userKey,
        secret: loginResult.secret,
        deviceId,
        deviceName
      };

      saveConfig(config);

      return {
        ok: true,
        data: {
          userKey: loginResult.userKey,
          deviceId,
          deviceName,
          needsRestart: false
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message
      };
    }
  });
}

function startRealtimeIfConfigured() {
  const config = loadConfig();

  if (!config.secret || !config.deviceId) {
    logLine('realtime skipped: secret/deviceId missing');
    return;
  }

  if (realtimeSocket) {
    try {
      realtimeSocket.removeAllListeners();
      realtimeSocket.close();
    } catch {}
    realtimeSocket = null;
  }

  logLine('starting realtime connection');

  realtimeSocket = connectRealtime({
    secret: config.secret,
    deviceId: config.deviceId,
    onSync: async () => {
      logLine('WS ! received -> syncMessagesOnce()');
      await syncMessagesOnce();
      reconnectDelayMs = 3000;
    },
    onReconnect: (reason) => {
      logLine(`WS R received: ${reason}`);
      scheduleReconnect(reason);
    },
    onFatal: (frame) => {
      logLine(`WS fatal frame received: ${frame}`);

      new Notification({
        title: 'Pushover Client',
        body: `リアルタイム受信停止: ${frame}`
      }).show();
    },
    onLog: (msg) => {
      logLine(msg);
    }
  });

  realtimeSocket.on('close', () => {
    if (realtimeSocket) {
      scheduleReconnect('socket closed');
    }
  });
}

function scheduleReconnect(reason) {
  if (reconnectTimer) {
    return;
  }

  logLine(`schedule reconnect: ${reason} in ${reconnectDelayMs}ms`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startRealtimeIfConfigured();
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
  }, reconnectDelayMs);
}

app.whenReady().then(() => {
  setupIpc();
  createTray();
  startRealtimeIfConfigured();
}).catch((err) => {
  console.error('Startup failed:', err);
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  app.removeAllListeners('window-all-closed');
});
