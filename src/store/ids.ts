// レシピ・記録を見分ける ID を作る

/** 新しい ID。crypto.randomUUID が使えない環境（https でない場合など）では時刻と乱数で作る */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // 下の作り方にする
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
