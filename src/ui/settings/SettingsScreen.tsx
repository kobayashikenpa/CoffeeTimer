// 設定画面（仕様 6.4・10・11）
import { settingsStore } from '../../store/settings'
import { Switch } from '../common/Switch'
import { useSettings } from '../hooks'
import { ApiKeySection } from './ApiKeySection'
import { BackupSection } from './BackupSection'
import './settings.css'

export function SettingsScreen({ onSaveResult }: { onSaveResult: (ok: boolean) => void }) {
  const settings = useSettings()
  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0 }}>
        設定
      </h1>

      <ApiKeySection onSaveResult={onSaveResult} />

      <section className="card stack" aria-labelledby="sound-title">
        <h2 id="sound-title" className="section-title">
          音と読み上げ
        </h2>
        <p className="muted small" style={{ margin: 0 }}>
          タイマーを開いたときの最初の状態です。タイマー画面でも、その場で切り替えられます。
        </p>
        <Switch
          label="音"
          note="手順が変わったときに音で知らせます"
          checked={settings.soundOn}
          onChange={(on) => onSaveResult(settingsStore().update({ soundOn: on }))}
        />
        <Switch
          label="読み上げ"
          note="手順名と注ぐ量を読み上げます"
          checked={settings.speechOn}
          onChange={(on) => onSaveResult(settingsStore().update({ speechOn: on }))}
        />
        <p className="muted small" style={{ margin: 0 }}>
          スマホがマナーモード（消音）のときは、音や読み上げが鳴らないことがあります。
        </p>
      </section>

      <BackupSection />

      <section className="card stack" aria-labelledby="home-title">
        <h2 id="home-title" className="section-title">
          ホーム画面に追加する
        </h2>
        <p style={{ margin: 0 }}>
          ホーム画面に追加すると、アプリのように開けます。保存したレシピも消えにくくなります。
        </p>
        <div className="stack" style={{ gap: 4 }}>
          <h3 className="howto-title">iPhone（Safari）</h3>
          <ol className="howto">
            <li>このページを Safari で開きます</li>
            <li>画面の下（または上）の共有ボタン（四角から上向きの矢印）を押します</li>
            <li>「ホーム画面に追加」を選び、「追加」を押します</li>
          </ol>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h3 className="howto-title">Android（Chrome）</h3>
          <ol className="howto">
            <li>このページを Chrome で開きます</li>
            <li>右上の「︙」（メニュー）を押します</li>
            <li>「ホーム画面に追加」（または「アプリをインストール」）を選び、「追加」を押します</li>
          </ol>
        </div>
      </section>

      <section className="card stack" aria-labelledby="data-title">
        <h2 id="data-title" className="section-title">
          データの保存について
        </h2>
        <p style={{ margin: 0 }}>
          レシピ・淹れた記録・設定は、この端末のブラウザの中にだけ保存されます。ほかの端末とは共有されません。
        </p>
        <div className="notice notice-warn">
          <p>
            iPhone の Safari
            は、7日間このページを開かないと、保存したデータを消すことがあります。「ホーム画面に追加」して使うと消えにくくなります。
          </p>
        </div>
        <p style={{ margin: 0 }}>念のため、ときどき上の「バックアップを書き出す」でファイルを保存しておいてください。</p>
      </section>
    </div>
  )
}
