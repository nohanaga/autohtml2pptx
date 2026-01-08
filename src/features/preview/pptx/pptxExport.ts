import PptxGenJS from 'pptxgenjs'

const PPT_W_IN = 13.333 // 16:9 wide
const PPT_H_IN = 7.5

export async function buildPptxBlobFromPngDataUrl(pngDataUrl: string): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const slide = pptx.addSlide()
  slide.addImage({ data: pngDataUrl, x: 0, y: 0, w: PPT_W_IN, h: PPT_H_IN })

  // ブラウザでは write('blob') が使える想定。型が曖昧なので any 経由。
  const blob = (await (pptx as any).write('blob')) as Blob
  return blob
}

/**
 * PptxGenJSのHTML-to-PowerPoint機能（tableToSlides）で、HTMLテーブルをPPTX要素として生成する。
 * NOTE: 公式docs上、対象は「HTML table」のみ（任意のHTMLをそのまま変換は不可）。
 */
export async function buildPptxBlobFromHtmlTableId(tableElementId: string): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  // 1つのテーブルが複数スライドに自動分割される可能性がある
  ;(pptx as any).tableToSlides(tableElementId, {
    x: 0.5,
    y: 0.5,
    w: PPT_W_IN - 1.0,
    h: PPT_H_IN - 1.0,
    autoPage: true,
  })

  const blob = (await (pptx as any).write('blob')) as Blob
  return blob
}
