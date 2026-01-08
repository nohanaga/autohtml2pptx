import JsonView from '@uiw/react-json-view'
import { useMemo, useState } from 'react'

export function JsonViewer(props: { value: unknown }) {
  // Bootstrapに合わせて余計な装飾は足さない
  const [collapsed, setCollapsed] = useState<boolean | number>(2)

  // uiw/react-json-view は collapsed の変更がツリーに反映されにくいことがあるため、keyで再マウントする
  const viewerKey = useMemo(() => `jsonview:${collapsed === false ? 'expand' : 'collapse'}`, [collapsed])

  return (
    <div className="d-flex flex-column gap-2 flex-grow-1" style={{ minHeight: 0 }}>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCollapsed(false)}>
          Expand all
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCollapsed(true)}>
          Collapse all
        </button>
      </div>

      <div className="border rounded p-2 app-border app-surface flex-grow-1" style={{ minHeight: 0, overflow: 'auto' }}>
        <JsonView
          key={viewerKey}
          value={props.value as any}
          collapsed={collapsed}
          enableClipboard={true}
          displayDataTypes={false}
        />
      </div>
    </div>
  )
}
