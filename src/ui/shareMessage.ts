// ファイルを書き出した結果の知らせ（人に渡す・バックアップ）
import type { ShareResult } from '../store/transfer'

/** 画面に出す文。やめたときは何も出さない（null） */
export function shareMessage(result: ShareResult, what: string): string | null {
  switch (result) {
    case 'shared':
      return `${what}のファイルを送りました`
    case 'downloaded':
      return `${what}をファイルとして保存しました。スマホの「ファイル」や「ダウンロード」に入っています`
    case 'cancelled':
      return null
    case 'failed':
      return `${what}のファイルを作れませんでした。もう一度試してください`
  }
}
