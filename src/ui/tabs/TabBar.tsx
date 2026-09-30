// 下のタブ（仕様 4）
export type Tab = 'recipes' | 'records' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'recipes', label: 'レシピ', icon: '☕' },
  { id: 'records', label: '記録', icon: '✎' },
  { id: 'settings', label: '設定', icon: '⚙' },
]

export function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="画面の切り替え">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={current === t.id ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
