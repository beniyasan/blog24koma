# 4コマ生成 (blog24koma)

ブログ記事のURLから4コマ漫画を自動生成するWebアプリケーションです。

![4koma generator](https://img.shields.io/badge/Powered%20by-Gemini%20API-blue)

## 機能

- **対応サイト**: note.com / qiita.com / zenn.dev
- **絵コンテ生成**: Gemini 3 Pro で記事内容を4コマの脚本に変換
- **画像生成**: Nano Banana Pro (Gemini 3 Pro Image) で各コマの画像を生成
- **セキュリティ**: APIキーは保存せず、リクエスト処理中のみ使用

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + TypeScript + Vite |
| バックエンド | Cloudflare Pages Functions |
| AI | Gemini 3 Pro / Gemini 3 Pro Image |

## セットアップ

### 前提条件

- Node.js 18+
- npm 9+
- Gemini API キー ([Google AI Studio](https://aistudio.google.com/) で取得)

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/blog24koma.git
cd blog24koma

# 依存関係をインストール
npm install
```

### ローカル開発

```bash
# フロントエンド開発サーバー起動
npm run dev

# 別ターミナルで Functions をローカル実行
npm run preview
```

フロントエンド: http://localhost:5173
Functions: http://localhost:8788

### 本番デプロイ

```bash
# Cloudflare Pages にデプロイ
npm run deploy
```

## 使い方

1. アプリにアクセス
2. ブログ記事のURLを入力（note.com / qiita.com / zenn.dev）
3. 必要に応じて補足指示を入力
4. Gemini API キーを入力
5. 「4コマを生成する」をクリック
6. 1〜2分待つと4コマ漫画が表示されます

## セキュリティについて

- **APIキー非保存**: 入力されたAPIキーはサーバーに保存されません
- **ログ出力禁止**: APIキーはログに出力されません
- **URLホワイトリスト**: 対応ドメイン以外へのアクセスはブロック
- **HTTPS必須**: 全通信はHTTPSで暗号化

## API仕様

### `POST /api/generate-4koma`

**リクエスト:**
```json
{
  "articleUrl": "https://note.com/...",
  "userPrompt": "補足指示（任意）",
  "geminiApiKey": "AIzaSy..."
}
```

**レスポンス:**
```json
{
  "storyboard": [
    { "panel": 1, "description": "シーン説明", "dialogue": "セリフ" },
    ...
  ],
  "images": [
    { "panel": 1, "imageBase64": "data:image/png;base64,..." },
    ...
  ]
}
```

## ライセンス

MIT License

## 注意事項

- API利用料金はユーザー自身のGoogleアカウントに請求されます
- 生成されたコンテンツの利用責任はユーザーにあります
- このツール専用のAPIキーを使用することを推奨します
