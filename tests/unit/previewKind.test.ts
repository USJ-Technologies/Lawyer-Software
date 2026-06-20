import { describe, it, expect } from 'vitest'
import { classifyPreviewKind } from '@/lib/documents/preview'

describe('classifyPreviewKind', () => {
  it('classifies application/pdf as pdf', () => {
    expect(classifyPreviewKind('application/pdf')).toBe('pdf')
  })

  it('classifies any image/* mime type as image', () => {
    expect(classifyPreviewKind('image/png')).toBe('image')
    expect(classifyPreviewKind('image/jpeg')).toBe('image')
  })

  it('classifies other known mime types as unsupported', () => {
    expect(classifyPreviewKind('application/msword')).toBe('unsupported')
  })

  it('classifies a null mime type as unsupported', () => {
    expect(classifyPreviewKind(null)).toBe('unsupported')
  })
})
