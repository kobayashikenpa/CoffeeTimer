// 確認のダイアログ（削除・やめる など）
import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'キャンセル', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-title" className="dialog-title">
          {title}
        </p>
        {message && <p style={{ margin: 0 }}>{message}</p>}
        <div className="dialog-actions">
          <button type="button" className={`btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" ref={cancelRef} className="btn btn-block" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
