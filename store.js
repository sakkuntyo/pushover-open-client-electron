const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function saveConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    'utf8'
  );
}

module.exports = {
  loadConfig,
  saveConfig
};