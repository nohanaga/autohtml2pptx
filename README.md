# GenHTML2PPTX(in progress)

左ペインのチャットに要件を書くだけで、Azure OpenAI を使って **完全なHTMLドキュメント** を生成・更新し、右ペインでリアルタイムにプレビューできる開発ツールです。

右ペインでは HTML編集に加えて、生成された内容から **PPTX（編集可能）を生成してダウンロード** できます。

## できること

- **HTML生成**: チャットの会話履歴 + 現在のHTMLをコンテキストとして Azure OpenAI に渡し、HTML全体を更新
- **プレビュー**: 生成HTMLを `iframe` で即時表示
- **HTML編集**: 右ペインの `html` タブで直接編集（preview / pptx に反映）
- **PPTX生成 & ダウンロード**: 右ペイン `pptx` タブから 16:9（WIDE）の PPTX を生成して保存
- **PPTX生成モード（2系統）**:
	- モード1（実装案1）: Intent(JSON/座標なし) → 自動レイアウト → 座標付きPptxSpec → PPTX
	- モード2（実装案2）: DeckSpec(layout_type等/座標なし) → レンダラ → 座標付きPptxSpec → PPTX
- **OpenAIデバッグ表示**（開発向け）: 最後にサーバが Azure OpenAI に送った request / response をUIから確認
- **Bootstrap UI** + **テーマ切替**: System/Dark/Light/Midnight/Forest/Solarized（localStorage保存）

## 構成

- Frontend: Vite + React + TypeScript
- Backend API: Express + tsx（Viteのproxyで `/api` を中継）
- Azure OpenAI: Chat Completions REST（サーバ側から呼び出し。ブラウザにキーは露出しません）

## セットアップ

### 1) 依存関係

```bash
npm install
```

### 2) Azure OpenAI 設定

`.env.example` を `.env` にコピーして、値を設定します。

必須:

- `AZURE_OPENAI_ENDPOINT`（例: `https://<your-resource-name>.openai.azure.com/`）
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`

任意:

- `OPENAI_API_VERSION`（既定: `2024-10-21`）
- `PORT`（APIポート。既定: `8787`）

※ `.env` が未設定でも API サーバ自体は起動しますが、生成系APIは 503 を返します（UI上でエラー表示されます）。

## 起動

```bash
npm run dev
```

- フロント: http://localhost:5173/
- API: http://localhost:8787/api/health

Vite の proxy 設定により、フロントからの `/api/*` はローカルAPIへ転送されます。

## 使い方

1. 左ペイン `Chat` で要件を入力し、`送信 (Ctrl+Enter)`
2. 右ペイン `preview` で表示確認
3. 必要なら右ペイン `html` で微調整
4. 右ペイン `pptx` で `PPTXを生成` → `PPTXをダウンロード`

ヒント: 初期HTMLは `html/test.html` がある場合にそれを読み込み、無ければフォールバックHTMLが表示されます。

## スクリプト

- `npm run dev`: フロント（Vite）+ API（Express）を同時起動
- `npm run build`: TypeScript ビルド（project references）+ Vite build
- `npm run preview`: Vite preview
- `npm run lint`: ESLint

## API

- `GET /api/health`: `{ ok: true, configured: boolean }`
- `POST /api/generate-html`: HTML生成
- `POST /api/generate-pptx-spec`: PPTX座標付きSpec生成（LLM→Spec）
- `POST /api/generate-pptx-intent`: Intent生成（LLM→Intent）
- `POST /api/generate-deck-spec`: DeckSpec生成（LLM→DeckSpec）
- `GET /api/debug/openai-last`: 最後のOpenAI request/response（デバッグ有効時のみ）

## トラブルシュート

- `APIエラー (503)`: `.env` が未設定/不正の可能性。`.env.example` を参考に `AZURE_OPENAI_*` を設定してください。
- OpenAIデバッグが見えない: `GET /api/debug/openai-last` は本番相当では無効化されます。開発時は通常有効です。
- PPTX生成が失敗する: `pptx` タブでモードを切り替えて再生成してください（入力HTMLや会話内容により得手不得手があります）。