'use client'
import { useState } from 'react'
import { DocumentList, type DocumentRow } from '@/components/DocumentList'
import { DocumentPreview } from '@/components/DocumentPreview'
import { DocumentUploadZone } from '@/components/DocumentUploadZone'

export function DocumentManager({
  caseId,
  chamberId,
  documents,
}: {
  caseId: string
  chamberId: string
  documents: DocumentRow[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = documents.find((d) => d.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-8">
        <DocumentList documents={documents} selectedId={selectedId} onSelect={setSelectedId} />
        <DocumentPreview document={selected} />
      </div>
      <DocumentUploadZone caseId={caseId} chamberId={chamberId} />
    </div>
  )
}
