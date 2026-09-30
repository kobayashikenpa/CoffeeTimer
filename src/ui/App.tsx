// 画面の入り口：下のタブと画面の切り替え（仕様 4）
// 画面の切り替えはルーターを使わず、この App の状態で行う（architecture.md 2）
import { useState } from 'react'
import { recipeStore } from '../store/recipes'
import { settingsStore } from '../store/settings'
import { useRecipes } from './hooks'
import { RecipeList } from './recipes/RecipeList'
import { TabBar } from './tabs/TabBar'
import type { Tab } from './tabs/TabBar'

export default function App() {
  const [tab, setTab] = useState<Tab>('recipes')
  const [brokenNotice, setBrokenNotice] = useState(
    () => recipeStore().recoveredFromBroken || settingsStore().recoveredFromBroken,
  )
  const [saveFailed, setSaveFailed] = useState(false)
  const recipes = useRecipes()
  // タイマー画面の間は下のタブを隠す（U-05 でつなぐ）
  const hideTabs = false

  /** 端末に書けなかったときは案内を出す（画面の中では続けて使える） */
  const persisted = (ok: boolean) => {
    if (!ok) setSaveFailed(true)
  }

  return (
    <div className="app">
      <main className={`app-main${hideTabs ? ' no-tabs' : ''}`}>
        {brokenNotice && (
          <div className="notice notice-warn notice-row" role="status" style={{ marginBottom: 16 }}>
            <p>
              保存していたデータが読めなかったため、空の状態で始めました。読めなかったデータは、この端末の中に別にして残してあります。
            </p>
            <button type="button" className="btn btn-ghost" aria-label="この案内を閉じる" onClick={() => setBrokenNotice(false)}>
              ✕
            </button>
          </div>
        )}
        {saveFailed && (
          <div className="notice notice-danger notice-row" role="alert" style={{ marginBottom: 16 }}>
            <p>
              この端末に保存できませんでした。ブラウザのプライベートモードや設定で、保存が止められている可能性があります。ページを閉じると、変更は消えます。
            </p>
            <button type="button" className="btn btn-ghost" aria-label="この案内を閉じる" onClick={() => setSaveFailed(false)}>
              ✕
            </button>
          </div>
        )}
        {tab === 'recipes' && (
          <RecipeList
            recipes={recipes}
            onAdd={() => {}}
            onOpen={() => {}}
            onEdit={() => {}}
            onToggleFavorite={(id) => persisted(recipeStore().toggleFavorite(id))}
            onDelete={(id) => persisted(recipeStore().remove(id))}
          />
        )}
        {tab === 'records' && (
          <>
            <h1 className="page-title">記録</h1>
            <p className="muted">淹れた記録の機能は、今後の版で使えるようになります。</p>
          </>
        )}
        {tab === 'settings' && <h1 className="page-title">設定</h1>}
      </main>
      {!hideTabs && <TabBar current={tab} onChange={setTab} />}
    </div>
  )
}
