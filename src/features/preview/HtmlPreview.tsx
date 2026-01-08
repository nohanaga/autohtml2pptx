export function HtmlPreview(props: { title: string; html: string }) {
  return (
    <div className="card h-100 app-surface app-border">
      <div className="card-header d-flex align-items-center justify-content-between app-surface app-border">
        <div className="fw-semibold">{props.title}</div>
        <div className="small app-muted">iframe</div>
      </div>
      <div className="card-body p-0" style={{ minHeight: 0 }}>
        <iframe
          title="preview"
          style={{ width: '100%', height: '100%', border: 0 }}
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          srcDoc={props.html}
        />
      </div>
    </div>
  )
}
