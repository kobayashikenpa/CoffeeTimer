// 入力欄の見出し・誤り・注意をまとめる部品
import type { ReactNode } from 'react'

export interface FieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  warn?: string
  hint?: string
  children: ReactNode
}

export function Field({ id, label, required, error, warn, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="field-required">必須</span>}
      </label>
      {children}
      {hint && !error && <p className="muted small" style={{ margin: 0 }} id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
      {warn && <p className="field-warn">⚠ {warn}</p>}
    </div>
  )
}
