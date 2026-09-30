// 読み取りがうまくいかなかったときの文（仕様 6.3、glossary.md 5章）
import type { ReadErrorKind } from '../../ai/gemini'

export const READ_ERROR_MESSAGES: Record<Exclude<ReadErrorKind, 'cancelled'>, string> = {
  noKey: 'AI を使うには APIキーの設定が必要です',
  invalidKey: 'APIキーが正しくないようです。設定を確かめてください',
  quota: 'AI の利用回数の上限に達しました。しばらく待ってから試してください',
  video: 'この動画は読み取れませんでした。説明欄の文章を貼り付けて試してください',
  notFound: 'この動画からコーヒーのレシピを見つけられませんでした',
  network: 'インターネットにつながっていないようです',
  broken: '読み取りに失敗しました。もう一度試すか、文章の貼り付けを試してください',
  // 時間の上限（3分）を過ぎたとき。仕様 6.3 に無いので「壊れている」と同じ文にする（暫定）
  timeout: '読み取りに失敗しました。もう一度試すか、文章の貼り付けを試してください',
}

/** 読み取り中の文 */
export const READING_MESSAGE = {
  url: '動画を読み取っています（1〜2分かかることがあります）',
  // 文章のときの文は仕様に無いため、動画のときに合わせる（暫定）
  text: '文章を読み取っています（1〜2分かかることがあります）',
} as const
