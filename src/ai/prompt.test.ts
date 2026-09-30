import { describe, expect, it } from 'vitest'
import { MAX_TEXT_LENGTH, PROMPT, RESPONSE_SCHEMA, buildRequest } from './prompt'

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

describe('buildRequest（AI に送る本文）', () => {
  it('URL のときは file_data.file_uri と指示文、JSON で答える設定が入る', () => {
    const body = buildRequest({ kind: 'url', url: URL })
    expect(body.contents).toHaveLength(1)
    const parts = body.contents[0].parts
    expect(parts[0]).toEqual({ file_data: { file_uri: URL } })
    expect(parts[1]).toEqual({ text: PROMPT })
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBe(RESPONSE_SCHEMA)
  })

  it('文章のときは file_data が無く、指示文と貼り付けた文章が入る', () => {
    const body = buildRequest({ kind: 'text', text: '  豆15g、お湯250g。30秒蒸らす  ' })
    const parts = body.contents[0].parts
    expect(parts.some((p) => 'file_data' in p)).toBe(false)
    expect(JSON.stringify(body)).not.toContain('file_data')
    expect(parts).toHaveLength(1)
    const t = (parts[0] as { text: string }).text
    expect(t.startsWith(PROMPT)).toBe(true)
    expect(t).toContain('豆15g、お湯250g。30秒蒸らす')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBe(RESPONSE_SCHEMA)
  })

  it('長すぎる文章は切って送る', () => {
    const body = buildRequest({ kind: 'text', text: 'あ'.repeat(MAX_TEXT_LENGTH + 500) })
    const t = (body.contents[0].parts[0] as { text: string }).text
    expect(t.length).toBeLessThanOrEqual(PROMPT.length + MAX_TEXT_LENGTH + 200)
  })

  it('本文は JSON にできる', () => {
    expect(() => JSON.stringify(buildRequest({ kind: 'url', url: URL }))).not.toThrow()
  })
})

describe('指示文', () => {
  it('日本語に訳す・単位つきで答える・推測しない・見つからなければ found を false', () => {
    expect(PROMPT).toContain('日本語に訳')
    expect(PROMPT).toContain('単位')
    expect(PROMPT).toContain('推測')
    expect(PROMPT).toContain('found')
    expect(PROMPT).toContain('startSec')
  })
})

describe('返答の形（responseSchema）', () => {
  it('architecture.md 4.1 の項目がある', () => {
    expect(RESPONSE_SCHEMA.type).toBe('OBJECT')
    expect(Object.keys(RESPONSE_SCHEMA.properties)).toEqual([
      'found',
      'name',
      'author',
      'equipment',
      'description',
      'beans',
      'water',
      'temperature',
      'grind',
      'totalSec',
      'steps',
    ])
    expect(RESPONSE_SCHEMA.required).toEqual(['found', 'steps'])
    const step = RESPONSE_SCHEMA.properties.steps.items
    expect(Object.keys(step.properties)).toEqual(['startSec', 'name', 'description', 'target', 'caution'])
    expect(RESPONSE_SCHEMA.properties.grind.enum).toEqual(['extra_fine', 'fine', 'medium_fine', 'medium', 'coarse'])
    expect(RESPONSE_SCHEMA.properties.water.properties.unit.enum).toEqual(['g', 'ml', 'oz'])
    expect(RESPONSE_SCHEMA.properties.beans.properties.unit.enum).toEqual(['g', 'oz'])
    expect(RESPONSE_SCHEMA.properties.temperature.properties.unit.enum).toEqual(['C', 'F'])
  })
})
