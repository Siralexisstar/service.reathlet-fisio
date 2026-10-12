import { useEffect, useRef, useState } from 'react'
import { BookingDialog } from './components/BookingDialog'
import type { BookingIntent } from './components/BookingDialog'
import { Icon } from './components/Icon'
import { Modal } from './components/Modal'
import { contact, legalLinks, photographs, questions, recoverySteps, socialLinks, treatments } from './data'
import { LegalPage } from './components/LegalPage'
import { Trans, useTranslation } from 'react-i18next'
import './App.css'

function Brand() {
  const { t } = useTranslation()
  return <a className="brand" href="/" aria-label={t('common.home')}><img src="/images/simbolo.jpeg" alt="" width="46" height="46" /><span><strong>REATHLET</strong><small>{t('common.sportsPhysiotherapy')}</small></span></a>
}

const navigation = [['nav.clinic', '#clinica'], ['nav.treatments', '#tratamientos'], ['nav.recovery', '#metodo'], ['nav.contact', '#contacto']]

function Header({ onBook }: { onBook: () => void }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return <>
    <a className="skip-link" href="#contenido">{t('common.skipToContent')}</a>
    <div className="utility-bar"><div className="container"><span>{t('header.utility')}</span><span><Icon name="pin" size={14} />{t('header.location')}</span></div></div>
    <header className="header"><div className="container header-inner"><Brand /><nav className="desktop-nav" aria-label={t('common.mainNavigation')}>{navigation.map(([key, href]) => <a key={href} href={href}>{t(key)}</a>)}</nav><div className="header-actions"><div className="social-links" aria-label="Social media"><span className="sr-only">Social media</span>{socialLinks.map(link => <a key={link.name} className="social-link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${link.name} Reathlet`}><Icon name={link.icon} size={18} /></a>)}</div><button className="button button-primary small" onClick={onBook}><Icon name="calendar" size={17} />{t('common.bookAppointment')}</button><button className="mobile-menu" aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></div></div>{menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label={t('common.mobileNavigation')}>{navigation.map(([key, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{t(key)}</a>)}</nav>}</header>
  </>
}

function Hero({ onBook }: { onBook: () => void }) {
  const { t } = useTranslation()
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hoverPaused, setHoverPaused] = useState(false)

  useEffect(() => {
    if (!playing || hoverPaused) return
    const timer = window.setInterval(() => { if (!document.hidden) setSlide(index => (index + 1) % 3) }, 5000)
    return () => window.clearInterval(timer)
  }, [playing, hoverPaused])

  return <section className="hero"><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow"><span />{t('hero.eyebrow')}</p><h1><Trans i18nKey="hero.title" components={{ br: <br />, em: <em /> }} /></h1><p className="hero-description"><Trans i18nKey="hero.description" components={{ br: <br /> }} /></p><div className="hero-actions"><button className="button button-primary" onClick={onBook}>{t('hero.primary')}</button><a className="button button-outline" href="#tratamientos">{t('hero.secondary')}</a></div><div className="hero-assurance"><span><Icon name="shield" size={18} />{t('hero.individual')}</span><span><Icon name="heart" size={18} />{t('hero.pace')}</span></div></div><div className="hero-visual"><div className="photo-corner" aria-hidden="true" /><div className="hero-photo" aria-roledescription="carousel" aria-label={t('hero.carouselLabel')} onMouseEnter={() => setHoverPaused(true)} onMouseLeave={() => setHoverPaused(false)} onFocusCapture={() => setHoverPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverPaused(false) }}>
      {photographs.slice(0, 3).map((photo, index) => <img key={photo.src} src={photo.src} alt={index === slide ? photo.alt : ''} aria-hidden={index !== slide} className={`hero-slide ${slide === index ? 'active' : ''}`} style={{ objectPosition: photo.position }} width="1080" height="1920" fetchPriority={index === 0 ? 'high' : 'auto'} />)}
       <div className="hero-photo-caption"><span>{t('hero.caption')}</span><strong>Tu objetivo.<br />Nuestro punto de partida.</strong></div><div className="hero-carousel-controls"><div className="carousel-dots">{[0, 1, 2].map(index => <button key={index} aria-label={t('hero.photo', { number: index + 1 })} aria-current={slide === index ? 'true' : undefined} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} />)}</div><button className="photo-control" aria-label={playing ? t('hero.pause') : t('hero.play')} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} size={15} /></button></div>
     </div><div className="hero-float"><span className="icon-disc"><Icon name="activity" /></span><div><strong>{t('hero.floatTitle')}</strong><span>{t('hero.floatText')}</span></div></div><span className="vertical-note" aria-hidden="true">REATHLET · MOVE WITH CONFIDENCE</span></div></div></section>
}

function Treatments({ onSelect }: { onSelect: (index: number) => void }) {
  const { t } = useTranslation()
  const rail = useRef<HTMLDivElement>(null)
  const [limits, setLimits] = useState({ previous: false, next: true })

  useEffect(() => {
    const element = rail.current!
    const update = () => setLimits({ previous: element.scrollLeft > 4, next: element.scrollLeft + element.clientWidth < element.scrollWidth - 4 })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener('scroll', update, { passive: true })
    update()
    return () => { observer.disconnect(); element.removeEventListener('scroll', update) }
  }, [])

  function move(direction: number) {
    const element = rail.current!
    const width = element.firstElementChild?.getBoundingClientRect().width ?? element.clientWidth
    element.scrollBy({ left: direction * (width + 20), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return <section className="section" id="tratamientos"><div className="container"><div className="section-head"><div><p className="eyebrow">{t('treatments.eyebrow')}</p><h2><Trans i18nKey="treatments.title" components={{ br: <br />, span: <span /> }} /></h2></div><div className="section-side"><p><Trans i18nKey="treatments.intro" components={{ br: <br /> }} /></p><div className="carousel-buttons"><button className="icon-button" aria-label={t('treatments.previous')} disabled={!limits.previous} onClick={() => move(-1)}><Icon name="left" /></button><button className="icon-button" aria-label={t('treatments.next')} disabled={!limits.next} onClick={() => move(1)}><Icon name="right" /></button></div></div></div><div ref={rail} className="treatment-rail" aria-label={t('treatments.all')} tabIndex={0}>{treatments.map((treatment, index) => { const title = t(`content.treatments.${index}.title`, { defaultValue: treatment.title }); return <article className="treatment-card" key={treatment.title}><div className="treatment-top"><span className="treatment-icon"><Icon name={treatment.icon} size={27} /></span><span className="treatment-category">{t(`content.treatments.${index}.category`, { defaultValue: treatment.category }).toUpperCase()}</span></div><span className="card-number">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{t(`content.treatments.${index}.summary`, { defaultValue: treatment.summary })}</p><button className="text-button" aria-label={t('treatments.learn', { title })} onClick={() => onSelect(index)}>{t('treatments.learnText')}<Icon name="plus" size={18} /></button></article> })}</div><p className="section-footnote">{t('treatments.footnote')}</p></div></section>
}

function Recovery({ onBook }: { onBook: () => void }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const step = recoverySteps[selected]

  function focusStep(index: number) {
    const next = (index + 4) % 4
    setSelected(next)
    document.getElementById(`recovery-tab-${next}`)?.focus()
  }

  const localizedStep = (key: 'label' | 'subtitle' | 'title' | 'text', index: number, fallback: string) => t(`content.recovery.${index}.${key}`, { defaultValue: fallback })
  return <section className="section method-section" id="metodo"><div className="container"><div className="center-heading"><p className="eyebrow">{t('recovery.eyebrow')}</p><h2><Trans i18nKey="recovery.title" components={{ br: <br /> }} /></h2><p>{t('recovery.intro')}</p></div><div className="method-tabs"><div className="step-list" role="tablist" aria-label={t('recovery.tabs')}>{recoverySteps.map((item, index) => <button id={`recovery-tab-${index}`} className="step-tab" key={item.label} role="tab" data-state={selected === index ? 'active' : 'inactive'} aria-selected={selected === index} aria-controls="recovery-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusStep(event.key === 'Home' ? 0 : event.key === 'End' ? 3 : index + (event.key === 'ArrowRight' ? 1 : -1)) } }}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{localizedStep('label', index, item.label)}</span><small>{localizedStep('subtitle', index, item.subtitle)}</small></button>)}</div><div id="recovery-panel" className="step-content" role="tabpanel" aria-labelledby={`recovery-tab-${selected}`} tabIndex={0}><span className="step-content-icon"><Icon name={step.icon} size={34} /></span><div><span className="step-kicker">{t('recovery.step', { number: String(selected + 1).padStart(2, '0') })}</span><h3>{localizedStep('title', selected, step.title)}</h3><p>{localizedStep('text', selected, step.text)}</p></div><button className="button button-outline" onClick={onBook}>{t('recovery.cta')}</button></div></div></div></section>
}

function Clinic({ onBook }: { onBook: () => void }) {
  const { t } = useTranslation()
  const [photo, setPhoto] = useState(0)
  const change = (direction: number) => setPhoto(index => (index + direction + photographs.length) % photographs.length)
  return <section className="section" id="clinica"><div className="container clinic-grid"><div><div className="gallery-frame" aria-roledescription="carousel" aria-label={t('clinic.gallery')}>{photographs.map((item, index) => <img key={item.src} src={item.src} alt={photo === index ? item.alt : ''} aria-hidden={photo !== index} className={photo === index ? 'active' : ''} style={{ objectPosition: item.position }} loading="lazy" width="1080" height="1920" />)}<div className="gallery-caption"><span aria-live="polite">{photographs[photo].caption}</span><div className="gallery-pagination"><button className="photo-control" aria-label={t('clinic.previous')} onClick={() => change(-1)}><Icon name="left" size={19} /></button><span>{String(photo + 1).padStart(2, '0')} / {String(photographs.length).padStart(2, '0')}</span><button className="photo-control" aria-label={t('clinic.next')} onClick={() => change(1)}><Icon name="right" size={19} /></button></div></div></div><div className="gallery-thumbnails">{photographs.map((item, index) => <button key={item.src} aria-label={t('clinic.view', { caption: item.caption })} aria-current={photo === index ? 'true' : undefined} className={photo === index ? 'active' : ''} onClick={() => setPhoto(index)}><img src={item.src} alt="" loading="lazy" /></button>)}</div></div><div className="clinic-copy"><p className="eyebrow">{t('clinic.eyebrow')}</p><h2><Trans i18nKey="clinic.title" components={{ br: <br />, span: <span /> }} /></h2><p>{t('clinic.paragraph1')}</p><p>{t('clinic.paragraph2')}</p><ul className="check-list">{(t('clinic.benefits', { returnObjects: true }) as string[]).map(item => <li key={item}><Icon name="check" size={17} />{item}</li>)}</ul><div className="professional-card"><img src={photographs[2].src} alt={photographs[2].alt} loading="lazy" width="56" height="62" /><div><strong>{t('clinic.team')}</strong><span>{t('clinic.speciality')}</span><small>{t('clinic.registration')}</small></div><Icon name="shield" size={20} /></div><button className="text-button" onClick={onBook}>{t('clinic.talk')}<Icon name="chat" size={18} /></button></div></div></section>
}

function FAQ() {
  const { t } = useTranslation()
  return <section className="section faq-section"><div className="container faq-grid"><div><p className="eyebrow">{t('faq.eyebrow')}</p><h2><Trans i18nKey="faq.title" components={{ br: <br /> }} /></h2><p>{t('faq.intro')}</p></div><div className="faq-list">{questions.map((item, index) => <details key={item.question}><summary>{t(`content.faq.${index}.question`, { defaultValue: item.question })}<Icon name="plus" size={19} /></summary><p>{t(`content.faq.${index}.answer`, { defaultValue: item.answer })}</p></details>)}</div></div></section>
}

function Contact({ onBook }: { onBook: (intent?: BookingIntent) => void }) {
  const { t } = useTranslation()
  return <section className="contact-section" id="contacto"><div className="container contact-panel"><div className="contact-main"><p className="eyebrow">{t('contactSection.eyebrow')}</p><h2><Trans i18nKey="contactSection.title" components={{ br: <br /> }} /></h2><p><Trans i18nKey="contactSection.intro" components={{ br: <br /> }} /></p><div className="contact-actions"><button className="button button-primary" onClick={() => onBook({ patient: 'new' })}><Icon name="calendar" size={19} />{t('contactSection.firstVisit')}</button><button className="button button-light-outline" onClick={() => onBook({ patient: 'returning' })}>{t('contactSection.returning')}</button></div><span className="contact-note"><Icon name="shield" size={15} />{t('contactSection.note')}</span></div><div className="contact-details"><div><Icon name="pin" /><span><strong>{t('contactSection.findUs')}</strong><span>{contact.address}<br />{contact.city}</span><a href={contact.maps} target="_blank" rel="noopener noreferrer">{t('contactSection.directions')}</a></span></div><div><Icon name="clock" /><span><strong>{t('contactSection.schedule')}</strong><span><Trans i18nKey="contactSection.hours" components={{ br: <br /> }} /></span><small>{t('contactSection.sampleHours')}</small></span></div><div><Icon name="chat" /><span><strong>{t('contactSection.talk')}</strong><button className="contact-email" onClick={() => onBook({ channel: 'email' })}>{contact.email}</button><a className="whatsapp-link" href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent('Hola, Reathlet. Me gustaría solicitar información sobre una cita. ¿Podemos hablar de la disponibilidad? Gracias.')}`} target="_blank" rel="noopener noreferrer">{t('contactSection.whatsapp')}</a></span></div></div></div></section>
}

function Footer() {
  const { t } = useTranslation()
  return <footer className="footer"><div className="container"><div className="footer-top"><Brand /><p><Trans i18nKey="footer.tagline" components={{ br: <br /> }} /></p><a className="text-button" href="#contenido">{t('common.backToTop')}<Icon name="up" size={18} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Reathlet · Cornellà de Llobregat</span><nav aria-label={t('footer.legal')}>{legalLinks.map(item => <a key={item.slug} href={`/legal/${item.slug}`}>{item.label}</a>)}</nav></div><p className="prototype-note">{t('footer.prototype')}</p></div></footer>
}

function HomePage() {
  const { t } = useTranslation()
  const [booking, setBooking] = useState<BookingIntent | null>(null)
  const [selectedTreatment, setSelectedTreatment] = useState<number | null>(null)
  const onBook = (intent: BookingIntent = {}) => setBooking(intent)
  const treatment = selectedTreatment === null ? null : treatments[selectedTreatment]

  return <><Header onBook={() => onBook()} /><main id="contenido"><Hero onBook={() => onBook({ patient: 'new' })} /><div className="care-strip"><div className="container"><span><Icon name="scan" />{t('careStrip.assessment')}</span><span><Icon name="heart" />{t('careStrip.close')}</span><span><Icon name="activity" />{t('careStrip.recovery')}</span><span><Icon name="pin" />{t('careStrip.here')}</span></div></div><Treatments onSelect={setSelectedTreatment} /><Recovery onBook={() => onBook()} /><Clinic onBook={() => onBook()} /><FAQ /><Contact onBook={onBook} /></main><Footer /><a className="floating-contact" aria-label={t('contactSection.whatsapp')} href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent('Hola, Reathlet. Me gustaría solicitar información sobre una cita. ¿Podemos hablar de la disponibilidad? Gracias.')}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" /><span>{t('contactSection.floating')}</span></a>
    {treatment && <Modal className="treatment-dialog" label="treatment-title" closeLabel={t('common.closeTreatment')} onClose={() => setSelectedTreatment(null)}><p className="eyebrow">{t(`content.treatments.${selectedTreatment}.category`, { defaultValue: treatment.category }).toUpperCase()}</p><h2 id="treatment-title" data-slot="dialog-title">{t(`content.treatments.${selectedTreatment}.title`, { defaultValue: treatment.title })}</h2><p data-slot="dialog-description">{t(`content.treatments.${selectedTreatment}.description`, { defaultValue: treatment.description })}</p><div className="treatment-expect"><h3>{t('treatments.assessmentTitle')}</h3><p>{t('treatments.assessmentText')}</p></div><p className="fine-print">{t('treatments.footnote')}</p><button className="button button-primary" onClick={() => { setSelectedTreatment(null); onBook() }}>{t('treatments.askAbout')}</button></Modal>}
    {booking && <BookingDialog intent={booking} onClose={() => setBooking(null)} />}
  </>
}

export default function App() {
  const legalSlug = window.location.pathname.startsWith('/legal/') ? window.location.pathname.split('/')[2] : null
  return legalSlug ? <LegalPage slug={legalSlug} brand={<Brand />} /> : <HomePage />
}
