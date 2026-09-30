// 設定画面のバックアップ欄（仕様 10.2・10.3・11）
// 書き出す：レシピ・記録・設定（APIキーを除く）を1つのファイルにする
// 読み込む：今のデータに足す。読み込む前に件数を示して確認する。形が違うファイルは何も変えずにエラー
import { useRef, useState } from 'react'
import { backupFileName, parseBackupFile } from '../../engine/files'
import type { BackupFile, MergePlan } from '../../engine/files'
import { backupJson, importBackup, planImport, readFile, shareFile } from '../../store/transfer'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { shareMessage } from '../shareMessage'

type Status = { ok: boolean; text: string } | null

export function BackupSection() {
  const [status, setStatus] = useState<Status>(null)
  const [pending, setPending] = useState<{ backup: BackupFile; plan: MergePlan } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportBackup = () => {
    setStatus(null)
    // iPhone で共有の画面が開くよう、押した操作の中ですぐ呼ぶ
    void shareFile(backupFileName(new Date()), backupJson()).then((result) => {
      const text = shareMessage(result, 'バックアップ')
      setStatus(text === null ? null : { ok: result !== 'failed', text })
    })
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setStatus(null)
    const read = await readFile(file)
    if (!read.ok) {
      setStatus({
        ok: false,
        text:
          read.reason === 'tooLarge'
            ? 'ファイルが大きすぎるため、読み込めませんでした。何も変えていません'
            : 'ファイルを開けませんでした。何も変えていません',
      })
      return
    }
    const parsed = parseBackupFile(read.text)
    if (!parsed.ok) {
      setStatus({ ok: false, text: parsed.message })
      return
    }
    setPending({ backup: parsed.backup, plan: planImport(parsed.backup) })
  }

  const confirmImport = () => {
    if (!pending) return
    const { backup } = pending
    setPending(null)
    if (importBackup(backup)) {
      setStatus({
        ok: true,
        text: `バックアップを読み込みました（レシピ ${backup.recipes.length}件・淹れた記録 ${backup.records.length}件）`,
      })
    } else {
      setStatus({
        ok: false,
        text: 'この端末に保存できなかったため、読み込みをやめました。データは元のままです',
      })
    }
  }

  const overwritten = pending ? pending.plan.recipesOverwritten + pending.plan.recordsOverwritten : 0

  return (
    <section className="card stack" aria-labelledby="backup-title">
      <h2 id="backup-title" className="section-title">
        バックアップ
      </h2>
      <p style={{ margin: 0 }}>
        レシピ・淹れた記録・設定（音と読み上げ）を1つのファイルにまとめて保存します。APIキーはファイルに入りません。
      </p>
      <div className="notice">
        <p>
          データが消えたときや、スマホを買い替えたときに戻せるよう、ときどき「バックアップを書き出す」でファイルを保存しておきましょう。
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={exportBackup}>
        バックアップを書き出す
      </button>
      <button type="button" className="btn btn-block" onClick={() => fileRef.current?.click()}>
        バックアップを読み込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="backup-file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void chooseFile(file)
        }}
      />
      <p className="muted small" style={{ margin: 0 }}>
        読み込むと、今のデータに足します。同じレシピ・記録があれば、ファイルの内容で上書きします。
      </p>
      {status && (
        <p className={`key-result ${status.ok ? 'key-ok' : 'key-ng'}`} role={status.ok ? 'status' : 'alert'}>
          {status.ok ? '✓ ' : '⚠ '}
          {status.text}
        </p>
      )}

      {pending && (
        <ConfirmDialog
          title="バックアップを読み込みますか？"
          confirmLabel={overwritten > 0 ? '上書きして読み込む' : '読み込む'}
          danger={overwritten > 0}
          onConfirm={confirmImport}
          onCancel={() => setPending(null)}
        >
          <p style={{ margin: 0 }}>今のデータに、ファイルの中身を足します。</p>
          <table className="plan-table">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">足す</th>
                <th scope="col">上書き</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">レシピ</th>
                <td>{pending.plan.recipesAdded}件</td>
                <td>{pending.plan.recipesOverwritten}件</td>
              </tr>
              <tr>
                <th scope="row">淹れた記録</th>
                <td>{pending.plan.recordsAdded}件</td>
                <td>{pending.plan.recordsOverwritten}件</td>
              </tr>
            </tbody>
          </table>
          {overwritten > 0 && (
            <p className="field-warn">
              ⚠ 同じレシピ・記録 {overwritten}件は、ファイルの内容で上書きされます。上書きしたものは元に戻せません。
            </p>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            音・読み上げの設定も、ファイルのものになります。APIキーは変わりません。
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
