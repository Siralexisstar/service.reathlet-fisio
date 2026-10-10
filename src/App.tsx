import { useEffect, useRef, useState } from 'react'
import { BookingDialog } from './components/BookingDialog'
import type { BookingIntent } from './components/BookingDialog'
import { Icon } from './components/Icon'
import { Modal } from './components/Modal'
import { contact, legalLinks, photographs, questions, recoverySteps, treatments } from './data'
import { LegalPage } from './components/LegalPage'
import './App.css'

function Brand() {
  return <a className="brand" href="/" aria-label="Reathlet, inicio"><img src="/images/simbolo.jpeg" alt="" width="46" height="46" /><span><strong>REATHLET</strong><small>FISIOTERAPIA DEPORTIVA</small></span></a>
}

const navigation = [['La clínica', '#clinica'], ['Tratamientos', '#tratamientos'], ['Tu recuperación', '#metodo'], ['Contacto', '#contacto']]

function Header({ onBook }: { onBook: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <div className="utility-bar"><div className="container"><span>Tu movimiento merece cuidado.</span><span><Icon name="pin" size={14} />Cornellà de Llobregat, Barcelona</span></div></div>
    <header className="header"><div className="container header-inner"><Brand /><nav className="desktop-nav" aria-label="Navegación principal">{navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><div className="header-actions"><button className="button button-primary small" onClick={onBook}><Icon name="calendar" size={17} />Pide tu cita</button><button className="mobile-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></div></div>{menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Navegación móvil">{navigation.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>}</header>
  </>
}

function Hero({ onBook }: { onBook: () => void }) {
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hoverPaused, setHoverPaused] = useState(false)

  useEffect(() => {
    if (!playing || hoverPaused) return
    const timer = window.setInterval(() => { if (!document.hidden) setSlide(index => (index + 1) % 3) }, 5000)
    return () => window.clearInterval(timer)
  }, [playing, hoverPaused])

  return <section className="hero"><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow"><span />FISIOTERAPIA CON UN OBJETIVO: TÚ</p><h1>Vuelve a moverte.<br />Vuelve a <em>ser tú.</em></h1><p className="hero-description">Menos límites. Más vida.<br />Te acompañamos en tu recuperación con atención cercana, valoración precisa y un plan a tu medida.</p><div className="hero-actions"><button className="button button-primary" onClick={onBook}>Reserva tu primera visita</button><a className="button button-outline" href="#tratamientos">Explora los tratamientos</a></div><div className="hero-assurance"><span><Icon name="shield" size={18} />Atención individual</span><span><Icon name="heart" size={18} />A tu ritmo, contigo</span></div></div><div className="hero-visual"><div className="photo-corner" aria-hidden="true" /><div className="hero-photo" aria-roledescription="carrusel" aria-label="Fotografías de Reathlet" onMouseEnter={() => setHoverPaused(true)} onMouseLeave={() => setHoverPaused(false)} onFocusCapture={() => setHoverPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverPaused(false) }}>
      {photographs.slice(0, 3).map((photo, index) => <img key={photo.src} src={photo.src} alt={index === slide ? photo.alt : ''} aria-hidden={index !== slide} className={`hero-slide ${slide === index ? 'active' : ''}`} style={{ objectPosition: photo.position }} width="1080" height="1920" fetchPriority={index === 0 ? 'high' : 'auto'} />)}
      <div className="hero-photo-caption"><span>PERSONAS QUE CUIDAN DE PERSONAS</span><strong>Tu objetivo.<br />Nuestro punto de partida.</strong></div><div className="hero-carousel-controls"><div className="carousel-dots">{[0, 1, 2].map(index => <button key={index} aria-label={`Ver fotografía ${index + 1} de 3`} aria-current={slide === index ? 'true' : undefined} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} />)}</div><button className="photo-control" aria-label={playing ? 'Pausar carrusel' : 'Reproducir carrusel'} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} size={15} /></button></div>
    </div><div className="hero-float"><span className="icon-disc"><Icon name="activity" /></span><div><strong>Recupera lo que te mueve</strong><span>De tu día a día a tu próximo reto.</span></div></div><span className="vertical-note" aria-hidden="true">REATHLET · MOVE WITH CONFIDENCE</span></div></div></section>
}

function Treatments({ onSelect }: { onSelect: (index: number) => void }) {
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

  return <section className="section" id="tratamientos"><div className="container"><div className="section-head"><div><p className="eyebrow">CADA CUERPO. UN CAMINO.</p><h2>La técnica importa.<br /><span>Escucharte, más.</span></h2></div><div className="section-side"><p>No tienes que saber qué tratamiento necesitas.<br />{' '}Empezamos por conocerte y valorar tu caso.</p><div className="carousel-buttons"><button className="icon-button" aria-label="Tratamientos anteriores" disabled={!limits.previous} onClick={() => move(-1)}><Icon name="left" /></button><button className="icon-button" aria-label="Más tratamientos" disabled={!limits.next} onClick={() => move(1)}><Icon name="right" /></button></div></div></div><div ref={rail} className="treatment-rail" aria-label="Nuestros ocho tratamientos" tabIndex={0}>{treatments.map((treatment, index) => <article className="treatment-card" key={treatment.title}><div className="treatment-top"><span className="treatment-icon"><Icon name={treatment.icon} size={27} /></span><span className="treatment-category">{treatment.category.toUpperCase()}</span></div><span className="card-number">{String(index + 1).padStart(2, '0')}</span><h3>{treatment.title}</h3><p>{treatment.summary}</p><button className="text-button" aria-label={`Conocer ${treatment.title}`} onClick={() => onSelect(index)}>Conoce el tratamiento<Icon name="plus" size={18} /></button></article>)}</div><p className="section-footnote">Una valoración individual orienta la elección de las técnicas. No todos los tratamientos están indicados para todas las personas.</p></div></section>
}

function Recovery({ onBook }: { onBook: () => void }) {
  const [selected, setSelected] = useState(0)
  const step = recoverySteps[selected]

  function focusStep(index: number) {
    const next = (index + 4) % 4
    setSelected(next)
    document.getElementById(`recovery-tab-${next}`)?.focus()
  }

  return <section className="section method-section" id="metodo"><div className="container"><div className="center-heading"><p className="eyebrow">NO TIENES QUE RECORRERLO SOLO</p><h2>Un plan claro.<br />Un paso cada vez.</h2><p>Desde la primera conversación hasta volver a hacer lo que te gusta.</p></div><div className="method-tabs"><div className="step-list" role="tablist" aria-label="Etapas de la recuperación">{recoverySteps.map((item, index) => <button id={`recovery-tab-${index}`} className="step-tab" key={item.label} role="tab" data-state={selected === index ? 'active' : 'inactive'} aria-selected={selected === index} aria-controls="recovery-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusStep(event.key === 'Home' ? 0 : event.key === 'End' ? 3 : index + (event.key === 'ArrowRight' ? 1 : -1)) } }}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span><small>{item.subtitle}</small></button>)}</div><div id="recovery-panel" className="step-content" role="tabpanel" aria-labelledby={`recovery-tab-${selected}`} tabIndex={0}><span className="step-content-icon"><Icon name={step.icon} size={34} /></span><div><span className="step-kicker">PASO {String(selected + 1).padStart(2, '0')} · CONTIGO, EN TODO MOMENTO</span><h3>{step.title}</h3><p>{step.text}</p></div><button className="button button-outline" onClick={onBook}>Empezamos contigo</button></div></div></div></section>
}

function Clinic({ onBook }: { onBook: () => void }) {
  const [photo, setPhoto] = useState(0)
  const change = (direction: number) => setPhoto(index => (index + direction + photographs.length) % photographs.length)
  return <section className="section" id="clinica"><div className="container clinic-grid"><div><div className="gallery-frame" aria-roledescription="carrusel" aria-label="Conoce nuestra consulta">{photographs.map((item, index) => <img key={item.src} src={item.src} alt={photo === index ? item.alt : ''} aria-hidden={photo !== index} className={photo === index ? 'active' : ''} style={{ objectPosition: item.position }} loading="lazy" width="1080" height="1920" />)}<div className="gallery-caption"><span aria-live="polite">{photographs[photo].caption}</span><div className="gallery-pagination"><button className="photo-control" aria-label="Fotografía anterior" onClick={() => change(-1)}><Icon name="left" size={19} /></button><span>{String(photo + 1).padStart(2, '0')} / 04</span><button className="photo-control" aria-label="Fotografía siguiente" onClick={() => change(1)}><Icon name="right" size={19} /></button></div></div></div><div className="gallery-thumbnails">{photographs.map((item, index) => <button key={item.src} aria-label={`Ver ${item.caption}`} aria-current={photo === index ? 'true' : undefined} className={photo === index ? 'active' : ''} onClick={() => setPhoto(index)}><img src={item.src} alt="" loading="lazy" /></button>)}</div></div><div className="clinic-copy"><p className="eyebrow">CONOCE REATHLET</p><h2>Tecnología que ayuda.<br /><span>Personas que escuchan.</span></h2><p>Detrás de cada lesión hay una persona y algo a lo que quiere volver. Entrenar, trabajar, pasear o simplemente moverse con más confianza.</p><p>En Reathlet combinamos la valoración clínica, la tecnología y el trabajo manual para acompañarte con un tratamiento que tiene sentido para ti.</p><ul className="check-list">{['Tiempo para escucharte y resolver tus dudas.', 'Explicaciones claras, sin tecnicismos innecesarios.', 'Objetivos compartidos y seguimiento de tu evolución.'].map(item => <li key={item}><Icon name="check" size={17} />{item}</li>)}</ul><div className="professional-card"><img src={photographs[2].src} alt={photographs[2].alt} loading="lazy" width="56" height="62" /><div><strong>Tu equipo de fisioterapia</strong><span>Fisioterapia deportiva y musculoesquelética</span><small>N.º de colegiado: 00.000 · dato de muestra</small></div><Icon name="shield" size={20} /></div><button className="text-button" onClick={onBook}>Hablemos de tu recuperación<Icon name="chat" size={18} /></button></div></div></section>
}

function FAQ() {
  return <section className="section faq-section"><div className="container faq-grid"><div><p className="eyebrow">CON TRANQUILIDAD, DESDE EL PRINCIPIO</p><h2>Es normal<br />tener preguntas.</h2><p>Estas son algunas de las más habituales antes de la primera visita.</p></div><div className="faq-list">{questions.map(item => <details key={item.question}><summary>{item.question}<Icon name="plus" size={19} /></summary><p>{item.answer}</p></details>)}</div></div></section>
}

function Contact({ onBook }: { onBook: (intent?: BookingIntent) => void }) {
  return <section className="contact-section" id="contacto"><div className="container contact-panel"><div className="contact-main"><p className="eyebrow">TU SIGUIENTE PASO EMPIEZA AQUÍ</p><h2>Hacemos sitio<br />a tu recuperación.</h2><p>Cuéntanos qué te gustaría volver a hacer.<br />Nosotros te ayudamos a dar el primer paso.</p><div className="contact-actions"><button className="button button-primary" onClick={() => onBook({ patient: 'new' })}><Icon name="calendar" size={19} />Es mi primera visita</button><button className="button button-light-outline" onClick={() => onBook({ patient: 'returning' })}>Ya soy paciente</button></div><span className="contact-note"><Icon name="shield" size={15} />Solicitud sin compromiso. Cita sujeta a confirmación.</span></div><div className="contact-details"><div><Icon name="pin" /><span><strong>Nos encontrarás en Cornellà</strong><span>{contact.address}<br />{contact.city}</span><a href={contact.maps} target="_blank" rel="noopener noreferrer">Cómo llegar</a></span></div><div><Icon name="clock" /><span><strong>Un horario que encaje contigo</strong><span>Lunes a viernes · 9:00–20:00</span><small>Horario orientativo de esta propuesta.</small></span></div><div><Icon name="chat" /><span><strong>Hablemos</strong><button className="contact-email" onClick={() => onBook({ channel: 'email' })}>{contact.email}</button><button className="whatsapp-link" onClick={() => onBook({ channel: 'whatsapp' })}>Contactar por WhatsApp</button></span></div></div></div></section>
}

function Footer() {
  return <footer className="footer"><div className="container"><div className="footer-top"><Brand /><p>El movimiento es parte de ti.<br />Cuidarlo es nuestra forma de acompañarte.</p><a className="text-button" href="#contenido">Volver al inicio<Icon name="up" size={18} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Reathlet · Cornellà de Llobregat</span><nav aria-label="Información legal">{legalLinks.map(item => <a key={item.slug} href={`/legal/${item.slug}`}>{item.label}</a>)}</nav></div><p className="prototype-note">Propuesta inicial · Datos profesionales y horarios de muestra. Las solicitudes y firmas del formulario se simulan.</p></div></footer>
}

function HomePage() {
  const [booking, setBooking] = useState<BookingIntent | null>(null)
  const [selectedTreatment, setSelectedTreatment] = useState<number | null>(null)
  const onBook = (intent: BookingIntent = {}) => setBooking(intent)
  const treatment = selectedTreatment === null ? null : treatments[selectedTreatment]

  return <><Header onBook={() => onBook()} /><main id="contenido"><Hero onBook={() => onBook({ patient: 'new' })} /><div className="care-strip"><div className="container"><span><Icon name="scan" />Valoración y tecnología</span><span><Icon name="heart" />Un trato cercano</span><span><Icon name="activity" />Recuperación a tu medida</span><span><Icon name="pin" />Aquí, en Cornellà</span></div></div><Treatments onSelect={setSelectedTreatment} /><Recovery onBook={() => onBook()} /><Clinic onBook={() => onBook()} /><FAQ /><Contact onBook={onBook} /></main><Footer /><button className="floating-contact" aria-label="Solicitar contacto por WhatsApp" onClick={() => onBook({ channel: 'whatsapp' })}><Icon name="chat" /><span>Hablemos</span></button>
    {treatment && <Modal className="treatment-dialog" label="treatment-title" closeLabel="Cerrar tratamiento" onClose={() => setSelectedTreatment(null)}><p className="eyebrow">{treatment.category.toUpperCase()}</p><h2 id="treatment-title" data-slot="dialog-title">{treatment.title}</h2><p data-slot="dialog-description">{treatment.description}</p><div className="treatment-expect"><h3>Primero, tu valoración</h3><p>Te explicamos la técnica, sus objetivos, posibles riesgos y alternativas. El profesional determina si es adecuada para tu caso; puedes preguntar y decidir con tranquilidad.</p></div><p className="fine-print">La información es orientativa. Las técnicas invasivas requieren valoración y consentimiento asistencial específico.</p><button className="button button-primary" onClick={() => { setSelectedTreatment(null); onBook() }}>Consulta tu caso</button></Modal>}
    {booking && <BookingDialog intent={booking} onClose={() => setBooking(null)} />}
  </>
}

export default function App() {
  const legalSlug = window.location.pathname.startsWith('/legal/') ? window.location.pathname.split('/')[2] : null
  return legalSlug ? <LegalPage slug={legalSlug} brand={<Brand />} /> : <HomePage />
}
