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

## 自動起動

Windows の `shell:startup` を使ってショートカットを置く想定です。

## 免責

このアプリは非公式クライアントです。  
Pushover の Open Client API を利用していますが、公式提供・公式サポートのクライアントではありません。
