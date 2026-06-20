import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-xs font-mono uppercase tracking-widest text-ink-soft mb-1">
      {children}
    </span>
  )
}

export function Field({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input className={`field-input ${className}`} {...props} />
    </label>
  )
}

export function TextField({
  label,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <textarea className={`field-input ${className}`} {...props} />
    </label>
  )
}

export function SelectField({
  label,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <select className={`field-input ${className}`} {...props}>
        {children}
      </select>
    </label>
  )
}
