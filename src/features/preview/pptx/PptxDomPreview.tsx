import type { CSSProperties } from 'react'
import type { PptxSlideObject, PptxSlideSpec } from '../../../shared/pptxSpec'
import { SLIDE_SIZE_IN } from './pptxFromSpec'

const PX_PER_IN = 96
const PX_PER_PT = 96 / 72

function boxStyle(box: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    position: 'absolute',
    left: box.x * PX_PER_IN,
    top: box.y * PX_PER_IN,
    width: box.w * PX_PER_IN,
    height: box.h * PX_PER_IN,
    overflow: 'hidden',
  }
}

function textStyle(options?: any): CSSProperties {
  return {
    fontFamily: options?.fontFace,
    fontSize: options?.fontSize ? options.fontSize * PX_PER_PT : undefined,
    fontWeight: options?.bold ? 700 : undefined,
    fontStyle: options?.italic ? 'italic' : undefined,
    textDecoration: options?.underline ? 'underline' : undefined,
    color: options?.color ? `#${options.color}` : undefined,
    textAlign: options?.align,
    lineHeight: options?.lineSpacing ? `${options.lineSpacing * PX_PER_PT}px` : undefined,
  }
}

function renderObject(obj: PptxSlideObject) {
  switch (obj.kind) {
    case 'text':
      return (
        <div key={obj.id ?? JSON.stringify(obj)} style={boxStyle(obj.box)}>
          <div style={{ width: '100%', height: '100%', ...textStyle(obj.options) }}>{obj.text}</div>
        </div>
      )
    case 'bullets':
      return (
        <div key={obj.id ?? JSON.stringify(obj)} style={boxStyle(obj.box)}>
          <ul style={{ margin: 0, paddingLeft: '1.2em', ...textStyle(obj.options) }}>
            {obj.items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )
    case 'table':
      return (
        <div key={obj.id ?? JSON.stringify(obj)} style={boxStyle(obj.box)}>
          <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', ...textStyle(obj.options) }}>
            <tbody>
              {obj.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ padding: 6 }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'image':
      return (
        <div key={obj.id ?? JSON.stringify(obj)} style={boxStyle(obj.box)}>
          {/* dataUrl優先 */}
          <img
            alt=""
            src={(obj.dataUrl ?? obj.url) || ''}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )
    case 'chart':
      // チャートのDOM再現は最小（実PPTXはPptxGenJSが生成）
      return (
        <div key={obj.id ?? JSON.stringify(obj)} style={{ ...boxStyle(obj.box), ...textStyle(obj.options) }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{obj.options?.title ?? 'Chart'}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{obj.chartType} / series: {obj.data.length}</div>
        </div>
      )
    default:
      return null
  }
}

export function PptxDomPreview(props: { slide: PptxSlideSpec }) {
  const bg = props.slide.backgroundColor ? `#${props.slide.backgroundColor}` : '#FFFFFF'

  return (
    <div
      className="pptx-dom-preview"
      style={{
        position: 'relative',
        width: SLIDE_SIZE_IN.w * PX_PER_IN,
        height: SLIDE_SIZE_IN.h * PX_PER_IN,
        background: bg,
      }}
    >
      {props.slide.objects.map(renderObject)}
    </div>
  )
}
