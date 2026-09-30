// ON／OFF の切り替え（押しやすい大きさ。hover に頼らない）
export function Switch({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (next: boolean) => void; note?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {note && (
          <span className="muted small" style={{ display: 'block' }}>
            {note}
          </span>
        )}
      </span>
      <span className="switch-state">{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}
