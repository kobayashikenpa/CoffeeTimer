import { describe, expect, it } from 'vitest'
import { FILE_MESSAGES, applyMerge, backupFileName, parseBackupFile, planMerge, toBackupFile, toSharedRecipeFile } from './files'
import type { BrewRecord, Recipe, Settings } from './types'

function recipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: `レシピ${id}`,
    author: '',
    videoUrl: '',
    equipment: 'V60',
    beansG: 15,
    waterG: 250,
    tempC: 92,
    grind: '中細挽き',
    description: '',
    totalSec: 180,
    steps: [{ startSec: 0, name: '蒸らし', description: '', targetG: 250, caution: false, cautionText: '' }],
    favorite: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}

function record(id: string, over: Partial<BrewRecord> = {}): BrewRecord {
  return {
    id,
    brewedAt: '2026-09-30T08:00:00.000Z',
    recipeId: 'a',
    recipeName: 'レシピa',
    beansG: 20,
    waterG: 333,
    beanName: '',
    rating: 4,
    memo: '',
    updatedAt: '2026-09-30T08:00:00.000Z',
    ...over,
  }
}

const settings: Settings = { soundOn: false, speechOn: true }
const NOW = '2026-09-30T10:00:00.000Z'

describe('toBackupFile・parseBackupFile（仕様 10.2）', () => {
  it('書き出して読み取ると、同じレシピ・記録・設定になる', () => {
    const recipes = [recipe('a', { favorite: true }), recipe('b')]
    const records = [record('x'), record('y', { recipeId: 'gone', recipeName: '消したレシピ', rating: null })]
    const text = JSON.stringify(toBackupFile(recipes, records, settings, NOW), null, 2)
    const result = parseBackupFile(text)
    expect(result).toEqual({
      ok: true,
      backup: { app: 'CoffeeTimer', kind: 'backup', version: 1, exportedAt: NOW, recipes, records, settings },
    })
  })

  it('APIキーは入れない（設定に紛れ込んでいても入れない）', () => {
    const polluted = { ...settings, apiKey: 'test-key-not-real-123' } as Settings
    const text = JSON.stringify(toBackupFile([recipe('a')], [record('x')], polluted, NOW))
    expect(text).not.toContain('test-key-not-real-123')
    expect(text).not.toContain('apiKey')
    expect(Object.keys(toBackupFile([], [], polluted, NOW).settings).sort()).toEqual(['soundOn', 'speechOn'])
  })

  it('空のデータも書き出して読める', () => {
    const result = parseBackupFile(JSON.stringify(toBackupFile([], [], settings, NOW)))
    expect(result.ok && result.backup.recipes.length === 0 && result.backup.records.length === 0).toBe(true)
  })

  it('JSON でない・ほかのアプリのファイルはエラー', () => {
    for (const text of ['', 'abc', '{', 'null', '[]', '{"app":"X","kind":"backup","version":1}']) {
      expect(parseBackupFile(text)).toEqual({ ok: false, message: FILE_MESSAGES.notBackup })
    }
  })

  it('レシピのファイルを渡すと、ファイルから受け取るを案内するエラー', () => {
    const text = JSON.stringify(toSharedRecipeFile(recipe('a')))
    expect(parseBackupFile(text)).toEqual({ ok: false, message: FILE_MESSAGES.recipeGiven })
  })

  it('版が違えばエラー', () => {
    const file = { ...toBackupFile([], [], settings, NOW), version: 2 }
    expect(parseBackupFile(JSON.stringify(file))).toEqual({ ok: false, message: FILE_MESSAGES.newerVersion })
  })

  it('中の1件だけ形が違っても、全体をエラーにする', () => {
    const file = toBackupFile([recipe('a'), recipe('b')], [record('x'), record('y')], settings, NOW)
    const bads = [
      { ...file, recipes: [file.recipes[0], { ...file.recipes[1], beansG: 'たくさん' }] },
      { ...file, records: [file.records[0], { ...file.records[1], rating: 7 }] },
      { ...file, settings: { soundOn: 'はい', speechOn: true } },
      { ...file, recipes: undefined },
      { ...file, records: {} },
      // 同じ ID が2つある
      { ...file, recipes: [file.recipes[0], file.recipes[0]] },
      { ...file, records: [file.records[0], file.records[0]] },
    ]
    for (const bad of bads) {
      expect(parseBackupFile(JSON.stringify(bad))).toEqual({ ok: false, message: FILE_MESSAGES.brokenBackup })
    }
  })

  it('形は合っていても、保存できないレシピ（仕様 5.3 のエラー）が1件でもあれば、全体をエラーにする', () => {
    const step = (startSec: number, targetG: number | null = null) => ({
      startSec,
      name: '注ぐ',
      description: '',
      targetG,
      caution: false,
      cautionText: '',
    })
    const bads: Partial<Recipe>[] = [
      // 手順が開始の時刻の順に並んでいない
      { steps: [step(0), step(60), step(30)] },
      // 最初の手順の開始が 0 でない
      { steps: [step(10), step(60)] },
      // 完成時刻が最後の手順の開始以前
      { totalSec: 60, steps: [step(0), step(60)] },
      { totalSec: 30, steps: [step(0), step(60)] },
      // 湯量・目標量が整数でない
      { waterG: 250.5 },
      { steps: [step(0, 120.5)] },
      // 目標量が 0 以下
      { steps: [step(0, 0)] },
      { steps: [step(0, -10)] },
      // レシピ名・手順名が空
      { name: '  ' },
      { steps: [{ ...step(0), name: '' }] },
    ]
    for (const over of bads) {
      const file = toBackupFile([recipe('a'), recipe('b', over)], [record('x')], settings, NOW)
      expect(parseBackupFile(JSON.stringify(file))).toEqual({ ok: false, message: FILE_MESSAGES.brokenBackup })
    }
  })

  it('注意（目標量が湯量と違う など）だけのレシピは読み込める', () => {
    const r = recipe('a', {
      steps: [
        { startSec: 0, name: '蒸らし', description: '', targetG: 60, caution: false, cautionText: '' },
        { startSec: 30, name: '2投目', description: '', targetG: 40, caution: false, cautionText: '' },
      ],
    })
    const result = parseBackupFile(JSON.stringify(toBackupFile([r], [], settings, NOW)))
    expect(result.ok).toBe(true)
  })
})

describe('planMerge・applyMerge（今のデータに足す）', () => {
  const current = {
    recipes: [recipe('a'), recipe('b')],
    records: [record('x')],
    settings: { soundOn: true, speechOn: true },
  }
  const incoming = toBackupFile(
    [recipe('b', { name: '読み込んだb' }), recipe('c')],
    [record('x', { memo: '読み込んだx' }), record('y'), record('z')],
    settings,
    NOW,
  )

  it('足す件数・上書きする件数を数える', () => {
    expect(planMerge(current, incoming)).toEqual({
      recipesAdded: 1,
      recipesOverwritten: 1,
      recordsAdded: 2,
      recordsOverwritten: 1,
    })
  })

  it('新しいものは足され、ID が同じものは読み込んだほうで上書きされる。設定は読み込んだほう', () => {
    const merged = applyMerge(current, incoming)
    expect(merged.recipes.map((r) => [r.id, r.name])).toEqual([
      ['a', 'レシピa'],
      ['b', '読み込んだb'],
      ['c', 'レシピc'],
    ])
    expect(merged.records.map((r) => [r.id, r.memo])).toEqual([
      ['x', '読み込んだx'],
      ['y', ''],
      ['z', ''],
    ])
    expect(merged.settings).toEqual(settings)
    // 元のデータは変えない
    expect(current.recipes[1].name).toBe('レシピb')
  })

  it('今が空なら、すべて足す', () => {
    const empty = { recipes: [], records: [], settings: { soundOn: true, speechOn: true } }
    expect(planMerge(empty, incoming)).toEqual({ recipesAdded: 2, recipesOverwritten: 0, recordsAdded: 3, recordsOverwritten: 0 })
    expect(applyMerge(empty, incoming).recipes).toHaveLength(2)
  })
})

describe('backupFileName', () => {
  it('coffeetimer-backup-YYYYMMDD.json（端末の日付）', () => {
    expect(backupFileName(new Date(2026, 8, 3, 23, 59))).toBe('coffeetimer-backup-20260903.json')
  })
})
