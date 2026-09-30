import { describe, expect, it } from 'vitest'
import { parseStoredRecipes, parseStoredSettings, toStoredRecipe } from './stored'
import type { Recipe } from './types'

const recipe: Recipe = {
  id: 'r1',
  name: '基本のハンドドリップ',
  author: '',
  videoUrl: '',
  equipment: 'V60',
  beansG: 15,
  waterG: 250,
  tempC: 92,
  grind: '中細挽き',
  description: '',
  totalSec: 180,
  steps: [
    { startSec: 0, name: '蒸らし', description: '', targetG: 50, caution: false, cautionText: '' },
    { startSec: 40, name: '1投目', description: '', targetG: 150, caution: false, cautionText: '' },
  ],
  favorite: false,
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
}

describe('toStoredRecipe', () => {
  it('正しい形のレシピはそのまま返す', () => {
    expect(toStoredRecipe(JSON.parse(JSON.stringify(recipe)))).toEqual(recipe)
  })
  it('挽き目・湯温が空（null）でも読める', () => {
    expect(toStoredRecipe({ ...recipe, grind: null, tempC: null })).not.toBeNull()
  })
  it('項目が足りない・型が違う・手順が0個・知らない挽き目は null', () => {
    const { name: _omit, ...noName } = recipe
    expect(toStoredRecipe(noName)).toBeNull()
    expect(toStoredRecipe({ ...recipe, beansG: '15' })).toBeNull()
    expect(toStoredRecipe({ ...recipe, steps: [] })).toBeNull()
    expect(toStoredRecipe({ ...recipe, grind: 'fine' })).toBeNull()
    expect(toStoredRecipe({ ...recipe, steps: [{ startSec: 0 }] })).toBeNull()
    expect(toStoredRecipe(null)).toBeNull()
  })
})

describe('parseStoredRecipes', () => {
  it('{ version: 1, items } を読む', () => {
    expect(parseStoredRecipes({ version: 1, items: [recipe] })).toEqual([recipe])
    expect(parseStoredRecipes({ version: 1, items: [] })).toEqual([])
  })
  it('版が違う・items が無い・1件でも壊れていれば null', () => {
    expect(parseStoredRecipes({ version: 2, items: [] })).toBeNull()
    expect(parseStoredRecipes({ version: 1 })).toBeNull()
    expect(parseStoredRecipes([recipe])).toBeNull()
    expect(parseStoredRecipes({ version: 1, items: [recipe, { id: 'x' }] })).toBeNull()
  })
})

describe('parseStoredSettings', () => {
  it('音・読み上げの ON／OFF を読む', () => {
    expect(parseStoredSettings({ soundOn: false, speechOn: true })).toEqual({ soundOn: false, speechOn: true })
  })
  it('形が違えば null', () => {
    expect(parseStoredSettings({ soundOn: 'yes', speechOn: true })).toBeNull()
    expect(parseStoredSettings(null)).toBeNull()
    expect(parseStoredSettings({})).toBeNull()
  })
})
