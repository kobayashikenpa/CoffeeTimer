// レシピの保存・一覧・お気に入り・削除（仕様 5.4、architecture.md 4.5）
import { sortForList } from '../engine/recipe'
import { parseStoredRecipes } from '../engine/stored'
import type { Recipe } from '../engine/types'
import { createEmitter, getBrowserStorage, loadJson, saveJson } from './storage'
import type { KeyValueStore } from './storage'

export const RECIPES_KEY = 'coffeetimer.recipes.v1'

export interface RecipeStore {
  /** 変更の通知を受ける（useSyncExternalStore 用） */
  subscribe(listener: () => void): () => void
  /** 一覧（お気に入りが上、その中は新しく追加・編集した順）。変更が無ければ同じ配列を返す */
  list(): readonly Recipe[]
  /** 1件を読む。無ければ undefined */
  get(id: string): Recipe | undefined
  /** 保存（同じ ID があれば置き換え）。updatedAt を今にする。端末に書けたら true */
  save(recipe: Recipe): boolean
  /** お気に入りの切り替え（並びの updatedAt は変えない）。端末に書けたら true */
  toggleFavorite(id: string): boolean
  /** 削除（淹れた記録は消さない）。端末に書けたら true */
  remove(id: string): boolean
  /** 読み込んだとき中身が壊れていて、退避して空で始めたか */
  readonly recoveredFromBroken: boolean
}

export function createRecipeStore(storage: KeyValueStore | null, now: () => Date = () => new Date()): RecipeStore {
  const loaded = loadJson(storage, RECIPES_KEY, parseStoredRecipes)
  let items: Recipe[] = loaded.value ?? []
  let sorted: readonly Recipe[] = sortForList(items)
  const emitter = createEmitter()

  function commit(next: Recipe[]): boolean {
    items = next
    sorted = sortForList(items)
    const ok = saveJson(storage, RECIPES_KEY, { version: 1, items })
    emitter.emit()
    return ok
  }

  return {
    subscribe: emitter.subscribe,
    list: () => sorted,
    get: (id) => items.find((r) => r.id === id),
    save(recipe) {
      const saved: Recipe = { ...recipe, updatedAt: now().toISOString() }
      const exists = items.some((r) => r.id === recipe.id)
      return commit(exists ? items.map((r) => (r.id === recipe.id ? saved : r)) : [...items, saved])
    },
    toggleFavorite(id) {
      if (!items.some((r) => r.id === id)) return true
      return commit(items.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)))
    },
    remove(id) {
      if (!items.some((r) => r.id === id)) return true
      return commit(items.filter((r) => r.id !== id))
    },
    recoveredFromBroken: loaded.broken,
  }
}

let instance: RecipeStore | null = null

/** アプリで使うレシピの保存先（ブラウザの localStorage） */
export function recipeStore(): RecipeStore {
  instance ??= createRecipeStore(getBrowserStorage())
  return instance
}
