# Pushover Open Client (Electron)

Electron ベースの非公式 Pushover Open Client です。  
Windows でトレイ常駐し、Pushover Open Client API を使ってリアルタイム通知を受信します。

## できること

- トレイ常駐
- 設定画面から Pushover へログイン
- Open Client 用 device 登録
- `messages.json` による未読取得
- `update_highest_message` による処理済みメッセージ削除
- WebSocket によるリアルタイム受信
- `!` 受信時の自動同期
- `R` 受信時の再接続
- `E` / `A` 受信時の停止
- Electron 通知によるデスクトップ通知

## ディレクトリ構成

```text
pushover-electron-client/
├─ main.js
├─ preload.js
├─ settings.html
├─ settings.js
├─ store.js
├─ pushover.js
├─ icon.png
├─ package.json
└─ forge.config.js   # Forge import 後
```

## 必要環境

- Windows
- Node.js
- npm

## 初回セットアップ

```bash
npm install
npm start
```

起動後、トレイメニューから **設定** を開き、以下を入力します。

- Email
- Password
- Device name
- 2FA code（必要な場合のみ）

保存が成功すると、設定はローカルに保存されます。

## 設定保存先

設定ファイルやログ類は `app.getPath('userData')` 配下に保存します。

保存される主なファイル:

- `config.json`
- `realtime.log`
- `last-messages.json`
- `last-delete.txt`
- `last-error.txt`

## 実行方法

### 開発モード

```bash
npm start
```

### 主な動作

- アプリ起動時に WebSocket 接続を開始
- Pushover から `!` を受信したら `syncMessagesOnce()` を実行
- 未読メッセージを取得して通知表示
- 最大 message id まで削除
- keep-alive `#` は無視

## トレイメニュー

- 設定
- 今すぐ同期
- 再接続
- テスト通知
- 終了

## パッケージング

### Forge の導入（初回のみ）

```bash
npm install --save-dev @electron-forge/cli
npx electron-forge import
```

### 配布物作成

```bash
npm run make
```

### パッケージのみ

```bash
npm run package
```

## package.json で重要な項目

Windows 向け配布では `author` が必要です。

例:

```json
{
  "name": "pushover-open-client-electron",
  "productName": "Pushover Open Client",
  "version": "0.1.0",
  "description": "Unofficial Pushover Open Client for Windows",
  "author": "Daisuke Sasaki",
  "license": "MIT"
}
```

## 実装メモ

### main.js

アプリ全体の制御を担当します。

- Electron 起動
- Tray 作成
- 設定画面表示
- IPC 登録
- WebSocket 接続開始
- 自動同期
- 通知表示

### preload.js

renderer から main へ IPC を安全に渡すためのブリッジです。

### settings.html / settings.js

設定 UI です。

- 保存済み設定の読込
- Pushover ログイン
- device 登録
- 保存

### store.js

設定ファイルの読み書きを担当します。

### pushover.js

Pushover API との通信を担当します。

- `login()`
- `registerDevice()`
- `fetchMessages()`
- `deleteUpTo()`
- `connectRealtime()`

## 既知の注意点

### 64-bit message id

Pushover の message id は大きいため、削除時の最大 id 判定には `Number()` を使わず、`id_str` と `BigInt` を使います。

例:

```js
const highestIdStr = messages.reduce((max, msg) => {
  const current = BigInt(msg.id_str || String(msg.id));
  return current > max ? current : max;
}, 0n).toString();
```

### パッケージ後のファイル書き込み

`__dirname` 配下、特に `app.asar` の中へログや JSON を書こうとすると失敗します。  
デバッグファイルやログは必ず `app.getPath('userData')` を使います。

## 自動起動

Windows の `shell:startup` を使ってショートカットを置く想定です。

## 今後の改善候補

- 設定保存後の自動再接続
- ログローテーション
- 優先度 2 の emergency message 対応
- 通知クリック時の URL オープン
- UI の見た目改善
- コード署名

## 免責

このアプリは非公式クライアントです。  
Pushover の Open Client API を利用していますが、公式提供・公式サポートのクライアントではありません。
