import { useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { ChatMessage } from '../../../shared/types/chat'
import type { PptxSpec } from '../../../shared/pptxSpec'
import { generateDeckSpec } from '../../pptx/deckApi'
import { generatePptxIntent } from '../../pptx/pptxIntentApi'
import { PptxDomPreview } from './PptxDomPreview'
import { buildPptxBlobFromSpec } from './pptxFromSpec'
import { buildPptxSpecFromDeck } from './layoutFromDeck'
import { buildPptxSpecFromIntent } from './layoutFromIntent'

const SLIDE_W_PX = 1280
const SLIDE_H_PX = 720

export function PptxPreviewPane(props: { html: string; messages: ChatMessage[] }) {
  const [mode, setMode] = useState<'mode1' | 'mode2'>('mode1')
  const [previewPng, setPreviewPng] = useState<string | null>(null)
  const [pptxBlob, setPptxBlob] = useState<Blob | null>(null)
  const [spec, setSpec] = useState<PptxSpec | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slideRootRef = useRef<HTMLDivElement | null>(null)

  const requestPayload = useMemo(
    () => ({ messages: props.messages, currentHtml: props.html }),
    [props.messages, props.html],
  )

  async function runGeneration() {
    if (busy) return

    setError(null)
    setBusy(true)
    setPptxBlob(null)
    setSpec(null)
    setPreviewPng(null)

    try {
      const payload = requestPayload

      let nextSpec: PptxSpec
      if (mode === 'mode1') {
        // Mode1(実装案1): Azure OpenAI -> Intent DSL(JSON) (座標なし) -> 自動レイアウト -> 座標付きSpec
        const result = await generatePptxIntent(payload)
        nextSpec = buildPptxSpecFromIntent(result)
      } else {
        // Mode2(NewDesign2): Azure OpenAI -> DeckSpec(layout_type) -> レンダラ -> 座標付きSpec
        const result = await generateDeckSpec(payload)
        nextSpec = buildPptxSpecFromDeck(result.deck)
      }

      setSpec(nextSpec)

      // Spec -> PptxGenJS (編集可能PPTX)
      const blob = await buildPptxBlobFromSpec(nextSpec)
      setPptxBlob(blob)

      // プレビュー（画像化）はSpecをDOM描画してからキャプチャ
      const root = slideRootRef.current
      if (!root) throw new Error('内部エラー: slideRoot が見つかりません')

      const dataUrl = await toPng(root, {
        cacheBust: true,
        pixelRatio: 2,
        width: SLIDE_W_PX,
        height: SLIDE_H_PX,
      })

      setPreviewPng(dataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!pptxBlob) return
    const url = URL.createObjectURL(pptxBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.pptx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
      <div className="border-bottom app-border px-3 py-2 d-flex align-items-center justify-content-between">
        <div className="small app-muted">PPTX preview</div>
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 170 }}
            value={mode}
            onChange={(e) => setMode(e.target.value === 'mode2' ? 'mode2' : 'mode1')}
            disabled={busy}
            aria-label="PPTX generation mode"
          >
            <option value="mode1">モード1（実装案1）</option>
            <option value="mode2">モード2（実装案2）</option>
          </select>
          <button type="button" className="btn btn-sm btn-primary" onClick={runGeneration} disabled={busy}>
            {busy ? '生成中…' : pptxBlob ? '再生成' : 'PPTXを生成'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={download} disabled={!pptxBlob || busy}>
            {busy ? '作成中…' : 'PPTXをダウンロード'}
          </button>
        </div>
      </div>

      <div className="border-bottom app-border px-3 py-2">
        <div className="accordion" id="pptx-mode-diff">
          <div className="accordion-item app-surface">
            <h2 className="accordion-header">
              <button
                className="accordion-button collapsed small app-muted py-2"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#pptx-mode-diff-body"
                aria-expanded="false"
                aria-controls="pptx-mode-diff-body"
              >
                モード1/モード2の違い
              </button>
            </h2>
            <div
              id="pptx-mode-diff-body"
              className="accordion-collapse collapse"
              data-bs-parent="#pptx-mode-diff"
            >
              <div className="accordion-body py-2">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0 small app-muted">
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>観点</th>
                        <th>モード1（実装案1）</th>
                        <th>モード2（実装案2）</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>LLMの出力</td>
                        <td>Intent（意味構造JSON / 座標なし）</td>
                        <td>DeckSpec（layout_type＋最小フィールド / 座標なし）</td>
                      </tr>
                      <tr>
                        <td>レイアウト</td>
                        <td>自動レイアウトで座標付きPptxSpecへ変換</td>
                        <td>layout_typeごとの固定レンダラでPptxSpecへ変換</td>
                      </tr>
                      <tr>
                        <td>狙い</td>
                        <td>内容量の増減に追従しやすい</td>
                        <td>レイアウトの再現性・安定性を優先</td>
                      </tr>
                      <tr>
                        <td>フロー</td>
                        <td>HTML/会話 → Intent → PptxSpec → PPTX</td>
                        <td>HTML/会話 → DeckSpec → PptxSpec → PPTX</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 overflow-auto" style={{ minHeight: 0 }}>
        {error ? (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        ) : null}

        {previewPng ? (
          <img
            alt="pptx preview"
            src={previewPng}
            className="img-fluid border rounded app-border"
          />
        ) : (
          <div className="small app-muted">「PPTXを生成」を押すとプレビューを作成します。</div>
        )}
      </div>

      {/* オフスクリーンでスライド用DOMをレンダリング（display:none不可） */}
      <div
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: SLIDE_W_PX,
          height: SLIDE_H_PX,
          overflow: 'hidden',
        }}
      >
        <div
          ref={slideRootRef}
          className="pptx-root"
          style={{ width: SLIDE_W_PX, height: SLIDE_H_PX, overflow: 'hidden' }}
        >
          {spec ? <PptxDomPreview slide={spec.slides[0]} /> : null}
        </div>
      </div>
    </div>
  )
}
