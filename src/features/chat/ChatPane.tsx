import { useMemo, useState } from 'react'
import type { ChatMessage } from '../../shared/types/chat'
import { JsonViewer } from './JsonViewer'
import { fetchLastOpenAiDebug, type OpenAiDebugEntry } from './openaiDebugApi'

export function ChatPane(props: {
  title: string
  messages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  loading: boolean
  error: string | null
}) {
  const [tab, setTab] = useState<'chat' | 'request' | 'response'>('chat')
  const [debugEntry, setDebugEntry] = useState<OpenAiDebugEntry | null>(null)
  const [debugBusy, setDebugBusy] = useState(false)

  const debugRequest = useMemo(() => {
    if (!debugEntry) return null
    return {
      at: debugEntry.at,
      kind: debugEntry.kind,
      requestUrl: debugEntry.requestUrl,
      requestBody: debugEntry.requestBody,
    }
  }, [debugEntry])

  const debugResponse = useMemo(() => {
    if (!debugEntry) return null
    return {
      at: debugEntry.at,
      kind: debugEntry.kind,
      responseStatus: debugEntry.responseStatus,
      responseJson: debugEntry.responseJson,
      responseText: debugEntry.responseText,
    }
  }, [debugEntry])

  async function refreshDebug() {
    if (debugBusy) return
    setDebugBusy(true)
    try {
      const last = await fetchLastOpenAiDebug()
      setDebugEntry(last)
    } finally {
      setDebugBusy(false)
    }
  }

  return (
    <div className="card h-100 app-surface app-border">
      <div className="card-header d-flex align-items-center justify-content-between app-surface app-border">
        <div className="fw-semibold">{props.title}</div>
        <div className="small app-muted">Azure OpenAI</div>
      </div>
      <div className="card-body d-flex flex-column gap-3" style={{ minHeight: 0 }}>
        <div className="d-flex align-items-center justify-content-between">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${tab === 'chat' ? 'active' : ''}`}
                onClick={() => setTab('chat')}
              >
                chat
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${tab === 'request' ? 'active' : ''}`}
                onClick={async () => {
                  setTab('request')
                  if (!debugEntry) await refreshDebug()
                }}
              >
                request
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${tab === 'response' ? 'active' : ''}`}
                onClick={async () => {
                  setTab('response')
                  if (!debugEntry) await refreshDebug()
                }}
              >
                response
              </button>
            </li>
          </ul>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={refreshDebug} disabled={debugBusy}>
            {debugBusy ? '更新中…' : '更新'}
          </button>
        </div>

        {tab === 'chat' ? (
          <div
            className="flex-grow-1 overflow-auto border rounded p-2 app-border"
            style={{ minHeight: 0, background: 'rgba(0,0,0,0.06)' }}
          >
            {props.messages.length === 0 ? (
              <div className="small app-muted">例: 「Bootstrapで、左にフォーム・右にプレビューのLPを作って」</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {props.messages.map((m, idx) => (
                  <div key={idx} className="d-flex flex-column">
                    <div className="small app-muted">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                    <div className="border rounded p-2 app-border app-surface" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === 'request' ? (
          debugRequest ? (
            <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="small app-muted mb-2">最後にOpenAIへ送信したリクエスト（server→OpenAI）</div>
              <JsonViewer value={debugRequest} />
            </div>
          ) : (
            <div className="small app-muted flex-grow-1">まだデータがありません（一度生成してから「更新」を押してください）。</div>
          )
        ) : null}

        {tab === 'response' ? (
          debugResponse ? (
            <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="small app-muted mb-2">最後にOpenAIから受け取ったレスポンス</div>
              <JsonViewer value={debugResponse} />
            </div>
          ) : (
            <div className="small app-muted flex-grow-1">まだデータがありません（一度生成してから「更新」を押してください）。</div>
          )
        ) : null}

        <div className="d-flex flex-column gap-2">
          {props.error ? (
            <div className="alert alert-danger py-2 mb-0" role="alert">
              {props.error}
            </div>
          ) : null}

          <textarea
            className="form-control"
            placeholder="作りたいHTMLの要件を入力…"
            rows={4}
            value={props.draft}
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') props.onSend()
            }}
            disabled={props.loading}
          />
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={props.onSend}
              disabled={props.loading || !props.draft.trim()}
            >
              {props.loading ? '生成中…' : '送信 (Ctrl+Enter)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
