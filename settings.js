const $ = (id) => document.getElementById(id);

const emailEl = $('email');
const passwordEl = $('password');
const deviceNameEl = $('deviceName');
const twofaEl = $('twofa');
const saveBtn = $('saveBtn');
const loadBtn = $('loadBtn');
const statusEl = $('status');

function setStatus(message) {
  statusEl.textContent = message;
}

function getFormValues() {
  return {
    email: emailEl.value.trim(),
    password: passwordEl.value,
    deviceName: deviceNameEl.value.trim(),
    twofa: twofaEl.value.trim()
  };
}

function validate(values) {
  if (!values.email) {
    return 'Email を入力してください';
  }
  if (!values.password) {
    return 'Password を入力してください';
  }
  if (!values.deviceName) {
    return 'Device name を入力してください';
  }
  return null;
}

async function loadSavedConfig() {
  try {
    setStatus('保存済み設定を読み込み中...');
    const result = await window.settingsApi.loadConfig();

    if (!result.ok) {
      setStatus(`読み込み失敗\n${result.error || 'unknown error'}`);
      return;
    }

    const cfg = result.config || {};
    emailEl.value = cfg.email || '';
    deviceNameEl.value = cfg.deviceName || '';
    twofaEl.value = '';

    setStatus('保存済み設定を読み込みました');
  } catch (err) {
    setStatus(`読み込み失敗\n${err.message}`);
  }
}

async function saveConfig() {
  const values = getFormValues();
  const error = validate(values);

  if (error) {
    setStatus(error);
    return;
  }

  saveBtn.disabled = true;

  try {
    setStatus('Pushover へログイン中...');
    const result = await window.settingsApi.loginAndSave(values);

    if (!result.ok) {
      setStatus(`保存失敗\n${result.error || 'unknown error'}`);
      return;
    }

    const lines = [
      '保存成功',
      `userKey: ${result.data?.userKey || ''}`,
      `deviceId: ${result.data?.deviceId || ''}`,
      `deviceName: ${result.data?.deviceName || values.deviceName}`
    ];

    if (result.data?.needsRestart) {
      lines.push('アプリ再起動で常駐受信開始');
    }

    passwordEl.value = '';
    twofaEl.value = '';

    setStatus(lines.join('\n'));
  } catch (err) {
    setStatus(`保存失敗\n${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener('click', () => {
  saveConfig();
});

loadBtn.addEventListener('click', () => {
  loadSavedConfig();
});

window.addEventListener('DOMContentLoaded', () => {
  loadSavedConfig();
});