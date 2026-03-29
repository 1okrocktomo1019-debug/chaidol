# チャイドル - 起動手順書

子ども向けバーチャル試着アプリ のプロトタイプです。

---

## 事前準備（初回のみ）

### 1. Python のインストール確認

```bash
python3 --version
# Python 3.9 以上であればOK
```

### 2. 仮想環境を作成して依存パッケージをインストール

```bash
cd /Users/tomo/iMedia-ai-team/dev/projects/chaidoru
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. APIキーを設定する

`.env.example` をコピーして `.env` ファイルを作成します。

```bash
cp .env.example .env
```

`.env` をテキストエディタで開いて、APIキーを入力してください。

```
FASHN_API_KEY=（FASHN.aiのAPIキーをここに入力）
RAKUTEN_APP_ID=（楽天ウェブサービスのアプリIDをここに入力）
RAKUTEN_AFFILIATE_ID=（楽天アフィリエイトIDをここに入力 ※任意）
```

**APIキーの取得先：**
- FASHN.ai API: https://fashn.ai/ でアカウント作成後、ダッシュボードから取得
- 楽天ウェブサービス: https://webservice.rakuten.co.jp/ でアプリ登録後に発行

---

## サーバー起動

```bash
cd /Users/tomo/iMedia-ai-team/dev/projects/chaidoru
source .venv/bin/activate
python main.py
```

起動すると以下のように表示されます：

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## アプリを開く

ブラウザで以下のURLを開きます：

```
http://localhost:8000
```

スマホで確認したい場合は、PC と同じ Wi-Fi に接続した状態で：

```
http://（PCのIPアドレス）:8000
```

---

## 使い方

1. **STEP 1** - 子どもの写真をタップして選ぶ（全身写真推奨）
2. **STEP 2** - 検索ボックスにキーワードを入力して「検索」（例：ワンピース、パーカー）
3. 服のカードをタップすると自動で試着開始（30〜60秒かかります）
4. **STEP 3** - 試着画像が表示されたら「楽天市場で購入する」ボタンで商品ページへ

---

## サーバーを止めるとき

ターミナルで `Ctrl + C` を押してください。

---

## ファイル構成

```
chaidoru/
├── .env.example          ← APIキー設定テンプレート（これをコピーして.envを作る）
├── .env                  ← 実際のAPIキー（gitに入れないこと！）
├── requirements.txt      ← Pythonパッケージ一覧
├── main.py               ← バックエンドサーバー（FastAPI）
├── README.md             ← この手順書
└── frontend/
    ├── index.html        ← アプリ画面
    └── static/
        ├── css/style.css ← デザイン
        └── js/app.js     ← 画面の動作
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 商品が表示されない | `.env` の `RAKUTEN_APP_ID` を確認 |
| 試着画像が生成されない | `.env` の `FASHN_API_KEY` を確認 |
| `ModuleNotFoundError` が出る | `pip install -r requirements.txt` を再実行 |
| ポート 8000 が使えない | `.env` に `PORT=8001` など別ポートを指定 |
