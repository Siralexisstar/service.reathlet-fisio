import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

export function HyroxPage({ onBook, sport = 'hyrox' }: { onBook: () => void; sport?: 'hyrox' | 'crossfit' | 'pulse' }) {
  const { t } = useTranslation()

  const contentKey = sport
  return <section className={`hyrox-page${sport === 'pulse' ? ' pulse-page' : ''}`} aria-labelledby={`${sport}-title`}>
    <div className="hyrox-track" aria-hidden="true"><span /><span /><span /></div>
    <div className="container hyrox-content">
      <div className="hyrox-topline">
        <a className="hyrox-back" href="/"><Icon name="left" size={17} />{t(`${contentKey}.backHome`)}</a>
        <span aria-hidden="true">REATHLET / {t(`nav.${sport}`)}</span>
      </div>
      <div className="hyrox-intro">
        <p className="eyebrow">{t(`${contentKey}.eyebrow`)}</p>
        <h1 id={`${sport}-title`}>{t(`nav.${sport}`)}</h1>
      </div>
      {sport === 'pulse' && <img className="pulse-logo" src="/images/pulse.jpeg" alt="PULSE — A High-Energy Movement Festival" width="1320" height="1320" />}
      <h2 className="hyrox-coming">{t(`${contentKey}.comingSoon`)}</h2>
      <div className="hyrox-energy" aria-hidden="true"><span /></div>
      <div className="hyrox-details">
        <div className="hyrox-copy">
          <p className="hyrox-subtitle">{t(`${contentKey}.subtitle`)}</p>
          <p className="hyrox-description">{t(`${contentKey}.description`)}</p>
        </div>
        <div className="hyrox-actions">
          <button className="button button-primary" onClick={onBook}><Icon name="calendar" size={18} />{t('common.bookAppointment')}</button>
          {sport === 'pulse' ? <>
            <a className="pulse-ticket-link" href="https://www.tickettailor.com/events/pulse8/2465512" target="_blank" rel="noopener noreferrer">{t('pulse.tickets')}<Icon name="right" size={18} /></a>
            <a className="hyrox-treatments" href="https://www.instagram.com/the.pulse.festival/" target="_blank" rel="noopener noreferrer">{t('pulse.instagram')}<Icon name="right" size={18} /></a>
          </> : <a className="hyrox-treatments" href="/#tratamientos">{t(`${contentKey}.treatments`)}<Icon name="right" size={18} /></a>}
        </div>
      </div>
    </div>
  </section>
}
