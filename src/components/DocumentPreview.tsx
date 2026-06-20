'use client'
import { useEffect, useState } from 'react'
import { getDocumentSignedUrl } from '@/app/(dashboard)/cases/actions'
import { classifyPreviewKind } from '@/lib/documents/preview'
import type { DocumentRow } from '@/components/DocumentList'

export function DocumentPreview({ document }: { document: DocumentRow | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUrl(null)
    setError(null)
    if (!document) return
    setLoading(true)
    getDocumentSignedUrl(document.id).then((result) => {
      setLoading(false)
      if (result.error || !result.url) {
        setError(result.error ?? 'Could not load this document')
        return
      }
      setUrl(result.url)
    })
  }, [document])

  if (!document) {
    return <p className="text-sm text-ink-soft">Select a document to preview it.</p>
  }

  if (loading) {
    return <p className="text-sm text-ink-soft">Loading preview…</p>
  }

  if (error || !url) {
    return <p className="text-sm text-seal">{error ?? 'This document could not be loaded.'}</p>
  }

  const kind = classifyPreviewKind(document.mime_type)

  if (kind === 'pdf') {
    return (
      <iframe
        src={url}
        title={document.label ?? 'Document preview'}
        className="w-full h-[32rem] border border-rule"
      />
    )
  }

  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={document.label ?? 'Document preview'} className="max-w-full border border-rule" />
    )
  }

  return (
    <p className="text-sm">
      Preview not available for this file type.{' '}
      <a href={url} target="_blank" rel="noreferrer" className="text-seal underline-offset-4 hover:underline">
        Download instead
      </a>
    </p>
  )
}
