// 画面の入り口：下のタブと画面の切り替え（仕様 4）
// 画面の切り替えはルーターを使わず、この App の状態で行う（architecture.md 2）
import { useState } from 'react'
import { recipeStore } from '../store/recipes'
import { settingsStore } from '../store/settings'
import { recipeToDraft, toRecipe } from '../engine/validate'
import { toRecord } from '../engine/record'
import { recordStore } from '../store/records'
import { newId } from '../store/ids'
import type { RecipeDraft } from '../engine/types'
import { AddRecipe } from './add/AddRecipe'
import { emptyAddForm } from './add/addForm'
import type { AddForm } from './add/addForm'
import { EditRecipe } from './edit/EditRecipe'
import { emptyDraft } from './edit/form'
import { useRecipes, useRecords } from './hooks'
import { TimerScreen } from './timer/TimerScreen'
import { RecipeList } from './recipes/RecipeList'
import { SettingsScreen } from './settings/SettingsScreen'
import { TabBar } from './tabs/TabBar'
import type { Tab } from './tabs/TabBar'

/** 「レシピ」タブの中の画面 */
type RecipeScreen =
  | { kind: 'list' }
  | { kind: 'add'; form: AddForm }
  | { kind: 'edit'; draft: RecipeDraft; fromAi: boolean; back: RecipeScreen }
  | { kind: 'timer'; recipeId: string }

export default function App() {
  const [tab, setTab] = useState<Tab>('recipes')
  const [screen, setScreenState] = useState<RecipeScreen>({ kind: 'list' })
  const setScreen = (next: RecipeScreen) => {
    setScreenState(next)
    window.scrollTo(0, 0)
  }
  const [brokenNotice, setBrokenNotice] = useState(
    () =>
      recipeStore().recoveredFromBroken || recordStore().recoveredFromBroken || settingsStore().recoveredFromBroken,
  )
  const [saveFailed, setSaveFailed] = useState(false)
  const recipes = useRecipes()
  const records = useRecords()
  const timerRecipe = screen.kind === 'timer' ? recipes.find((r) => r.id === screen.recipeId) : undefined
  // タイマー画面の間は下のタブを隠して画面を広く使う
  const hideTabs = tab === 'recipes' && timerRecipe !== undefined

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
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="この案内を閉じる"
              onClick={() => setBrokenNotice(false)}
            >
              ✕
            </button>
          </div>
        )}
        {saveFailed && (
          <div className="notice notice-danger notice-row" role="alert" style={{ marginBottom: 16 }}>
            <p>
              この端末に保存できませんでした。ブラウザのプライベートモードや設定で、保存が止められている可能性があります。ページを閉じると、変更は消えます。
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="この案内を閉じる"
              onClick={() => setSaveFailed(false)}
            >
              ✕
            </button>
          </div>
        )}
        {tab === 'recipes' && screen.kind === 'edit' && (
          <EditRecipe
            initial={screen.draft}
            fromAi={screen.fromAi}
            onSave={(draft) => {
              const existing = draft.id === null ? undefined : recipeStore().get(draft.id)
              const recipe = toRecipe(draft, {
                id: draft.id ?? newId(),
                nowIso: new Date().toISOString(),
                createdAt: existing?.createdAt,
              })
              persisted(recipeStore().save(recipe))
              setScreen({ kind: 'list' })
            }}
            onCancel={() => setScreen(screen.back)}
          />
        )}
        {tab === 'recipes' && screen.kind === 'add' && (
          <AddRecipe
            form={screen.form}
            onFormChange={(form) => setScreenState({ kind: 'add', form })}
            onRead={(draft) => setScreen({ kind: 'edit', draft, fromAi: true, back: screen })}
            onManual={() => setScreen({ kind: 'edit', draft: emptyDraft(), fromAi: false, back: screen })}
            onBack={() => setScreen({ kind: 'list' })}
            onOpenSettings={() => {
              setTab('settings')
              window.scrollTo(0, 0)
            }}
          />
        )}
        {tab === 'recipes' && timerRecipe && (
          <TimerScreen
            key={timerRecipe.id + timerRecipe.updatedAt}
            recipe={timerRecipe}
            onBack={() => setScreen({ kind: 'list' })}
            onEdit={() => setScreen({ kind: 'edit', draft: recipeToDraft(timerRecipe), fromAi: false, back: screen })}
            onSaveRecord={(draft) => {
              const record = toRecord(draft, { id: newId(), nowIso: new Date().toISOString() })
              persisted(recordStore().save(record))
              // 保存したら記録タブで見せる（レシピタブは一覧に戻す）
              setScreenState({ kind: 'list' })
              setTab('records')
              window.scrollTo(0, 0)
            }}
          />
        )}
        {tab === 'recipes' && (screen.kind === 'list' || (screen.kind === 'timer' && !timerRecipe)) && (
          <RecipeList
            recipes={recipes}
            onAdd={() => setScreen({ kind: 'add', form: emptyAddForm() })}
            onOpen={(id) => setScreen({ kind: 'timer', recipeId: id })}
            onEdit={(id) => {
              const r = recipeStore().get(id)
              if (r) setScreen({ kind: 'edit', draft: recipeToDraft(r), fromAi: false, back: screen })
            }}
            onToggleFavorite={(id) => persisted(recipeStore().toggleFavorite(id))}
            onDelete={(id) => persisted(recipeStore().remove(id))}
          />
        )}
        {tab === 'records' && (
          <>
            <h1 className="page-title">記録</h1>
            <p className="muted">淹れた記録：{records.length} 件</p>
          </>
        )}
        {tab === 'settings' && <SettingsScreen onSaveResult={persisted} />}
      </main>
      {!hideTabs && <TabBar current={tab} onChange={setTab} />}
    </div>
  )
}
