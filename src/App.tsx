import { useMemo, useState } from 'react'
import { ChatPane } from './features/chat/ChatPane'
import { generateHtml } from './features/chat/chatApi'
import type { ChatMessage } from './shared/types/chat'
import { RightPaneTabs } from './features/preview/RightPaneTabs'
import { APP_THEMES, useAppTheme } from './features/theme/useAppTheme'

const FALLBACK_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GenHTML2PPTX Preview</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; }
      .card { max-width: 840px; margin: 0 auto; padding: 24px; border-radius: 16px; border: 1px solid rgba(127,127,127,.25); }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0; opacity: .8; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>GenHTML2PPTX</h1>
      <p>左のチャットで要件を入力すると、ここにHTMLが生成されます。</p>
    </div>
  </body>
</html>`

function loadInitialHtml(): string {
  // html/test.html が存在する場合だけ読み込み、無ければフォールバックにする。
  // 直importするとファイル削除時にViteが解決できず例外になるため、globで安全に扱う。
  const modules = import.meta.glob('../html/*.html', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  return modules['../html/test.html'] ?? FALLBACK_HTML
}

const DEFAULT_HTML = loadInitialHtml()

export default function App() {
  const { themeId, setThemeId } = useAppTheme()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [html, setHtml] = useState<string>(DEFAULT_HTML)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedThemeLabel = useMemo(() => {
    return APP_THEMES.find((t) => t.id === themeId)?.label ?? 'Theme'
  }, [themeId])

  async function onSend() {
    const prompt = draft.trim()
    if (!prompt || loading) return

    setError(null)
    setLoading(true)
    setDraft('')

    const userMessage: ChatMessage = { role: 'user', content: prompt }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    try {
      const result = await generateHtml({ messages: nextMessages, currentHtml: html })
      setHtml(result.html)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'HTMLを更新しました。右ペインでプレビューを確認できます。',
        },
      ])
    } catch (e) {
      const message = e instanceof Error ? e.message : '不明なエラーが発生しました。'
      setError(message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '生成に失敗しました。設定とログを確認してください。' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg border-bottom app-border app-surface">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">GenHTML2PPTX</span>
          <div className="ms-auto d-flex gap-2 align-items-center">
            <div className="dropdown">
              <button
                className="btn btn-outline-secondary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {selectedThemeLabel}
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                {APP_THEMES.map((t) => (
                  <li key={t.id}>
                    <button
                      className={`dropdown-item ${t.id === themeId ? 'active' : ''}`}
                      onClick={() => setThemeId(t.id)}
                      type="button"
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <main className="app-main container-fluid py-3">
        <div className="row g-3 h-100">
          <div className="col-12 col-lg-4 h-100 pane">
            <ChatPane
              title="Chat"
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              onSend={onSend}
              loading={loading}
              error={error}
            />
          </div>
          <div className="col-12 col-lg-8 h-100 pane">
            <RightPaneTabs title="Right" html={html} onHtmlChange={setHtml} messages={messages} />
          </div>
        </div>
      </main>
    </div>
  )
}
