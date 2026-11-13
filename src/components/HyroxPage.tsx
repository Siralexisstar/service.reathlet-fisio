import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

export function HyroxPage({ onBook }: { onBook: () => void }) {
  const { t } = useTranslation()

  return <section className="hyrox-page" aria-labelledby="hyrox-title">
    <div className="hyrox-track" aria-hidden="true"><span /><span /><span /></div>
    <div className="container hyrox-content">
      <div className="hyrox-topline">
        <a className="hyrox-back" href="/"><Icon name="left" size={17} />{t('hyrox.backHome')}</a>
        <span aria-hidden="true">REATHLET / {t('nav.hyrox')}</span>
      </div>
      <div className="hyrox-intro">
        <p className="eyebrow">{t('hyrox.eyebrow')}</p>
        <h1 id="hyrox-title">{t('nav.hyrox')}</h1>
      </div>
      <h2 className="hyrox-coming">{t('hyrox.comingSoon')}</h2>
      <div className="hyrox-energy" aria-hidden="true"><span /></div>
      <div className="hyrox-details">
        <div className="hyrox-copy">
          <p className="hyrox-subtitle">{t('hyrox.subtitle')}</p>
          <p className="hyrox-description">{t('hyrox.description')}</p>
        </div>
        <div className="hyrox-actions">
          <button className="button button-primary" onClick={onBook}><Icon name="calendar" size={18} />{t('common.bookAppointment')}</button>
          <a className="hyrox-treatments" href="/#tratamientos">{t('hyrox.treatments')}<Icon name="right" size={18} /></a>
        </div>
      </div>
    </div>
  </section>
}
