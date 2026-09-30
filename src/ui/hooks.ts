// store と画面をつなぐ（useSyncExternalStore）
import { useSyncExternalStore } from 'react'
import type { BrewRecord, Recipe, Settings } from '../engine/types'
import { recordStore } from '../store/records'
import { recipeStore } from '../store/recipes'
import { settingsStore } from '../store/settings'
import { apiKeyStore } from '../store/apiKey'

/** レシピの一覧（お気に入りが上、その中は新しい順） */
export function useRecipes(): readonly Recipe[] {
  const store = recipeStore()
  return useSyncExternalStore(store.subscribe, store.list)
}

/** 1件のレシピ（無ければ undefined） */
export function useRecipe(id: string): Recipe | undefined {
  const list = useRecipes()
  return list.find((r) => r.id === id)
}

/** 設定（音・読み上げの初期値） */
export function useSettings(): Settings {
  const store = settingsStore()
  return useSyncExternalStore(store.subscribe, store.get)
}

/** APIキーが設定済みか（キーの文字そのものは画面に渡さない） */
export function useHasApiKey(): boolean {
  const store = apiKeyStore()
  return useSyncExternalStore(store.subscribe, store.has)
}

/** 淹れた記録の一覧（新しい順） */
export function useRecords(): readonly BrewRecord[] {
  const store = recordStore()
  return useSyncExternalStore(store.subscribe, store.list)
}
