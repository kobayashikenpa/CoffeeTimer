import { describe, expect, it } from 'vitest'
import { FILE_MESSAGES, parseSharedRecipeFile, sharedRecipeFileName, toSharedRecipeFile } from './files'
import type { Recipe } from './types'
import { recipeToDraft } from './validate'

const recipe: Recipe = {
  id: 'r1',
  name: '4:6メソッド',
  author: 'チャンネル',
  videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
  equipment: 'V60',
  beansG: 20,
  waterG: 300,
  tempC: 92,
  grind: '粗挽き',
  description: '味を調整できる淹れ方',
  totalSec: 210,
  steps: [
    { startSec: 0, name: '1投目', description: '', targetG: 60, caution: false, cautionText: '' },
    { startSec: 45, name: '2投目', description: 'ゆっくり', targetG: 120, caution: true, cautionText: '細く注ぐ' },
    { startSec: 90, name: '3投目', description: '', targetG: 300, caution: false, cautionText: '' },
  ],
  favorite: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
}

describe('toSharedRecipeFile（仕様 10.1）', () => {
  it('アプリ名・種類・版とレシピの中身を入れる', () => {
    const file = toSharedRecipeFile(recipe)
    expect(file.app).toBe('CoffeeTimer')
    expect(file.kind).toBe('recipe')
    expect(file.version).toBe(1)
    expect(file.recipe.name).toBe('4:6メソッド')
    expect(file.recipe.steps).toEqual(recipe.steps)
  })

  it('ID・お気に入り・日時・記録・APIキーを入れない', () => {
    // 余分な項目（APIキーなど）がレシピに紛れ込んでいても、ファイルには入れない
    const polluted = { ...recipe, apiKey: 'test-key-not-real', records: [{ id: 'x' }] } as Recipe
    const file = toSharedRecipeFile(polluted)
    const json = JSON.stringify(file)
    expect(Object.keys(file.recipe).sort()).toEqual(
      ['author', 'beansG', 'description', 'equipment', 'grind', 'name', 'steps', 'tempC', 'totalSec', 'videoUrl', 'waterG'].sort(),
    )
    for (const s of ['"id"', 'favorite', 'createdAt', 'updatedAt', 'apiKey', 'test-key-not-real', 'records']) {
      expect(json).not.toContain(s)
    }
  })
})

describe('parseSharedRecipeFile', () => {
  it('作ったファイルを読むと、元と同じ中身の下書き（新しいレシピ扱い：ID なし・お気に入りなし）になる', () => {
    const text = JSON.stringify(toSharedRecipeFile(recipe), null, 2)
    const result = parseSharedRecipeFile(text)
    expect(result).toEqual({ ok: true, draft: { ...recipeToDraft(recipe), id: null, favorite: false } })
  })

  it('湯温・挽き目が空のレシピも読める', () => {
    const r = { ...recipe, tempC: null, grind: null }
    const result = parseSharedRecipeFile(JSON.stringify(toSharedRecipeFile(r)))
    expect(result.ok && result.draft.tempC === null && result.draft.grind === null).toBe(true)
  })

  it('ファイルに ID・お気に入りが書き足されていても使わない', () => {
    const file = toSharedRecipeFile(recipe)
    const text = JSON.stringify({ ...file, recipe: { ...file.recipe, id: 'r1', favorite: true } })
    const result = parseSharedRecipeFile(text)
    expect(result.ok && result.draft.id === null && result.draft.favorite === false).toBe(true)
  })

  it('JSON でないファイル・ほかのアプリのファイルはエラー', () => {
    for (const text of ['', 'こんにちは', '{', '[]', 'null', '{"app":"Other","kind":"recipe","version":1,"recipe":{}}']) {
      expect(parseSharedRecipeFile(text)).toEqual({ ok: false, message: FILE_MESSAGES.notRecipe })
    }
  })

  it('バックアップのファイルを渡すと、バックアップの読み込みを案内するエラー', () => {
    const text = JSON.stringify({ app: 'CoffeeTimer', kind: 'backup', version: 1, recipes: [], records: [], settings: {} })
    expect(parseSharedRecipeFile(text)).toEqual({ ok: false, message: FILE_MESSAGES.backupGiven })
  })

  it('版が違えばエラー', () => {
    const file = { ...toSharedRecipeFile(recipe), version: 2 }
    expect(parseSharedRecipeFile(JSON.stringify(file))).toEqual({ ok: false, message: FILE_MESSAGES.newerVersion })
  })

  it('レシピの形が違えばエラー（豆の量が文字・手順が無い・手順の形が違う・挽き目が知らない値）', () => {
    const file = toSharedRecipeFile(recipe)
    const bads = [
      { ...file, recipe: undefined },
      { ...file, recipe: { ...file.recipe, beansG: '20' } },
      { ...file, recipe: { ...file.recipe, steps: [] } },
      { ...file, recipe: { ...file.recipe, steps: [{ name: 1 }] } },
      { ...file, recipe: { ...file.recipe, grind: 'とても細かい' } },
      { ...file, recipe: { ...file.recipe, name: null } },
    ]
    for (const bad of bads) {
      expect(parseSharedRecipeFile(JSON.stringify(bad))).toEqual({ ok: false, message: FILE_MESSAGES.broken })
    }
  })
})

describe('sharedRecipeFileName', () => {
  it('coffeetimer-recipe-<レシピ名>.json', () => {
    expect(sharedRecipeFileName(recipe)).toBe('coffeetimer-recipe-4_6メソッド.json')
  })
  it('ファイル名に使えない文字を置き換え、空なら recipe、長すぎれば切る', () => {
    expect(sharedRecipeFileName({ name: 'a/b\\c?*"<>|' })).toBe('coffeetimer-recipe-a_b_c______.json')
    expect(sharedRecipeFileName({ name: '   ' })).toBe('coffeetimer-recipe-recipe.json')
    expect(sharedRecipeFileName({ name: 'あ'.repeat(100) })).toBe(`coffeetimer-recipe-${'あ'.repeat(40)}.json`)
  })
})
