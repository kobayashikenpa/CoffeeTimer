// 画面の入り口：下のタブと画面の切り替え（仕様 4）
// 画面の切り替えはルーターを使わず、この App の状態で行う（architecture.md 2）
import { useState } from 'react'
import { recipeStore } from '../store/recipes'
import { settingsStore } from '../store/settings'
import { recipeToDraft, toRecipe } from '../engine/validate'
import { recordToDraft, toRecord } from '../engine/record'
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
import { RecordEditor } from './records/RecordEditor'
import { RecordsScreen } from './records/RecordsScreen'
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
  // 記録タブ：直している記録の ID（null は一覧）・絞り込み・知らせ
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [recordFilter, setRecordFilter] = useState<string | null>(null)
  const [recordNotice, setRecordNotice] = useState<string | null>(null)
  const editingRecord = editingRecordId === null ? undefined : records.find((r) => r.id === editingRecordId)
  const changeTab = (next: Tab) => {
    setTab(next)
    setRecordNotice(null)
    if (next === 'records') setEditingRecordId(null)
  }
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
              changeTab('records')
              setRecordNotice('淹れた記録を保存しました')
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
        {tab === 'records' && editingRecord && (
          <RecordEditor
            key={editingRecord.id}
            initial={recordToDraft(editingRecord)}
            onSave={(draft) => {
              persisted(recordStore().save(toRecord(draft, { id: editingRecord.id, nowIso: new Date().toISOString() })))
              setEditingRecordId(null)
              setRecordNotice('記録を保存しました')
              window.scrollTo(0, 0)
            }}
            onCancel={() => {
              setEditingRecordId(null)
              window.scrollTo(0, 0)
            }}
            onDelete={() => {
              persisted(recordStore().remove(editingRecord.id))
              setEditingRecordId(null)
              setRecordNotice('記録を削除しました')
              window.scrollTo(0, 0)
            }}
          />
        )}
        {tab === 'records' && !editingRecord && (
          <RecordsScreen
            records={records}
            recipes={recipes}
            filter={recordFilter}
            onFilterChange={setRecordFilter}
            onOpen={(id) => {
              setEditingRecordId(id)
              setRecordNotice(null)
              window.scrollTo(0, 0)
            }}
            notice={recordNotice}
            onCloseNotice={() => setRecordNotice(null)}
          />
        )}
        {tab === 'settings' && <SettingsScreen onSaveResult={persisted} />}
      </main>
      {!hideTabs && <TabBar current={tab} onChange={changeTab} />}
    </div>
  )
}
