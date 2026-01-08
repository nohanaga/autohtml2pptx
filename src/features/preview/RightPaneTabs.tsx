import { useMemo, useState } from 'react'
import { PptxPreviewPane } from './pptx/PptxPreviewPane'
import type { ChatMessage } from '../../shared/types/chat'

export type RightPaneTabId = 'preview' | 'html' | 'pptx'

export function RightPaneTabs(props: {
  title: string
  html: string
  onHtmlChange: (nextHtml: string) => void
  messages: ChatMessage[]
}) {
  const [tab, setTab] = useState<RightPaneTabId>('preview')

  const headerRight = useMemo(() => {
    return (
      <ul className="nav nav-tabs card-header-tabs">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'preview' ? 'active' : ''}`}
            onClick={() => setTab('preview')}
          >
            preview
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'html' ? 'active' : ''}`}
            onClick={() => setTab('html')}
          >
            html
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'pptx' ? 'active' : ''}`}
            onClick={() => setTab('pptx')}
          >
            pptx
          </button>
        </li>
      </ul>
    )
  }, [tab])

  return (
    <div className="card h-100 app-surface app-border d-flex flex-column" style={{ minHeight: 0 }}>
      <div className="card-header d-flex align-items-center justify-content-between app-surface app-border">
        <div className="fw-semibold">{props.title}</div>
        <div>{headerRight}</div>
      </div>

      <div className="card-body p-0 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
        <div style={{ display: tab === 'preview' ? 'block' : 'none', width: '100%', flex: 1, minHeight: 0 }}>
          <iframe
            title="preview"
            style={{ width: '100%', height: '100%', border: 0 }}
            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
            srcDoc={props.html}
          />
        </div>

        <div
          className="flex-grow-1"
          style={{ display: tab === 'html' ? 'flex' : 'none', flexDirection: 'column', minHeight: 0 }}
        >
          <div className="border-bottom app-border px-3 py-2 d-flex align-items-center justify-content-between">
            <div className="small app-muted">HTML source</div>
            <div className="small app-muted">編集すると preview/pptx に反映</div>
          </div>
          <textarea
            className="form-control rounded-0 border-0 flex-grow-1"
            style={{ minHeight: 0 }}
            value={props.html}
            onChange={(e) => props.onHtmlChange(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div style={{ display: tab === 'pptx' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
          <PptxPreviewPane html={props.html} messages={props.messages} />
        </div>
      </div>
    </div>
  )
}
