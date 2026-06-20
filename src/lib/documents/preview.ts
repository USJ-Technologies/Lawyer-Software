export type PreviewKind = 'pdf' | 'image' | 'unsupported'

export function classifyPreviewKind(mimeType: string | null): PreviewKind {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType?.startsWith('image/')) return 'image'
  return 'unsupported'
}
