import { describe, expect, it } from 'vitest'
import { APP_NAME } from './app'

// 土台（B-01）でテストが動くことを確かめる仮のテスト。E-01 で置き換えてよい
describe('APP_NAME', () => {
  it('アプリ名は CoffeeTimer', () => {
    expect(APP_NAME).toBe('CoffeeTimer')
  })
})
