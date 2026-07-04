import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createImageAnnotationTextOp,
  ImageAnnotationEditor,
  imageAnnotationTextNotes,
  shouldCommitImageAnnotationTextKey
} from './ImageAnnotationEditor'

function renderEditor(): string {
  return renderToStaticMarkup(
    createElement(ImageAnnotationEditor, {
      imageUrl: '.kun-design/image.png',
      workspaceRoot: '/workspace',
      title: 'image.png',
      onCancel: () => undefined,
      onApply: () => undefined
    })
  )
}

describe('ImageAnnotationEditor layout', () => {
  it('keeps the full-screen editor out of native window drag controls', () => {
    const html = renderEditor()

    expect(html).toContain('ds-no-drag fixed inset-0')
    expect(html).toContain('ds-drag flex shrink-0')
    expect(html).toContain('padding-left:calc(var(--ds-window-controls-safe-inset) + 1.25rem)')
  })

  it('renders the instruction input with visible text on a generated background class', () => {
    const html = renderEditor()

    expect(html).toContain('appearance-none')
    expect(html).toContain('bg-white/10')
    expect(html).toContain('text-white')
    expect(html).toContain('caret-white')
    expect(html).not.toContain('bg-white/12')
  })
})

describe('ImageAnnotationEditor text annotations', () => {
  it('creates trimmed pending text annotations', () => {
    expect(
      createImageAnnotationTextOp(
        { cssX: 10, cssY: 12, x: 100, y: 120 },
        '  改成蓝色  ',
        '#3b82f6',
        36
      )
    ).toEqual({
      kind: 'text',
      color: '#3b82f6',
      x: 100,
      y: 120,
      text: '改成蓝色',
      fontSize: 36
    })

    expect(createImageAnnotationTextOp(null, '改成蓝色', '#3b82f6', 36)).toBeNull()
    expect(createImageAnnotationTextOp({ cssX: 0, cssY: 0, x: 0, y: 0 }, '   ', '#3b82f6', 36)).toBeNull()
  })

  it('extracts text notes from committed and pending operations', () => {
    const textOp = createImageAnnotationTextOp(
      { cssX: 10, cssY: 12, x: 100, y: 120 },
      '标题放大',
      '#111827',
      24
    )

    if (!textOp) throw new Error('expected a text annotation op')

    expect(
      imageAnnotationTextNotes([
        { kind: 'arrow', color: '#ef4444', width: 4, from: { x: 0, y: 0 }, to: { x: 20, y: 20 } },
        textOp
      ])
    ).toEqual(['标题放大'])
  })

  it('does not commit Enter while an IME composition is active', () => {
    expect(shouldCommitImageAnnotationTextKey('Enter', false, false)).toBe(true)
    expect(shouldCommitImageAnnotationTextKey('Enter', true, false)).toBe(false)
    expect(shouldCommitImageAnnotationTextKey('Enter', false, true)).toBe(false)
    expect(shouldCommitImageAnnotationTextKey('a', false, false)).toBe(false)
  })
})
