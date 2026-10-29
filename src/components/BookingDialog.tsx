import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent, ReactNode } from 'react'
import { contact } from '../data'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useTranslation } from 'react-i18next'
import { availabilityOptions, durationOptions, regionOptions } from '../lib/firstVisit'
import type { FullRequest } from '../lib/firstVisit'

type Channel = 'whatsapp' | 'email'
export type BookingIntent = { patient?: 'new' | 'returning'; channel?: Channel }
type Step = 'choose' | 'data' | 'reason' | 'consent' | 'channel' | 'returning-data' | 'preview'
type Intake = { name: string; email: string; phone: string; availability: string; region: string; duration: string; reason: string; pain: string; history: string; medication: string; signature: string; privacy: boolean; healthConsent: boolean }
type Errors = Partial<Record<keyof Intake, string>>
const emptyIntake = (): Intake => ({ name: '', email: '', phone: '', availability: 'Sin preferencia', region: '', duration: '', reason: '', pain: '', history: '', medication: '', signature: '', privacy: false, healthConsent: false })
const emptyContact = () => ({ name: '', email: '', privacy: false })

const headings: Record<Step, [string, string]> = {
  choose: ['booking.chooseTitle', 'booking.chooseText'],
  data: ['booking.dataTitle', 'booking.dataText'],
  reason: ['booking.reasonTitle', 'booking.reasonText'],
  consent: ['booking.consentTitle', 'booking.consentText'],
  channel: ['booking.channelTitle', 'booking.channelText'],
  'returning-data': ['bookingContact.detailsTitle', 'bookingContact.detailsText'],
  preview: ['booking.previewTitle', 'booking.previewText'],
}

function Field({ id, label, children, error, required = false, optional = false }: { id: string; label: string; children: ReactNode; error?: string; required?: boolean; optional?: boolean }) {
  return <div className="field"><label htmlFor={id} className="field-label">{label} {required && <span aria-hidden="true">*</span>}{optional && <span className="optional">(opcional)</span>}</label>{children}{error && <span id={`${id}-error`} className="field-error">{error}</span>}</div>
}

function SignatureDrawing({ value, onChange }: { value: string; onChange: (signature: string) => void }) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<[number, number] | null>(null)

  useEffect(() => {
    const element = canvas.current!
    const context = element.getContext('2d')!
    context.clearRect(0, 0, element.width, element.height)
    if (!value) return
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0)
    image.src = value
    return () => { image.onload = null }
  }, [value])

  function draw(event: PointerEvent<HTMLCanvasElement>, start = false) {
    const element = canvas.current!
    const context = element.getContext('2d')!
    const rect = element.getBoundingClientRect()
    const point: [number, number] = [(event.clientX - rect.left) * element.width / rect.width, (event.clientY - rect.top) * element.height / rect.height]
    if (start) { drawing.current = true; element.setPointerCapture(event.pointerId); lastPoint.current = point }
    if (!drawing.current) return
    context.strokeStyle = '#102344'
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(...(lastPoint.current ?? point))
    context.lineTo(point[0] + (start ? 0.1 : 0), point[1])
    context.stroke()
    lastPoint.current = point
  }

  function finish() {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvas.current!.toDataURL())
  }

  function clear() { canvas.current?.getContext('2d')?.clearRect(0, 0, 960, 300); onChange('') }

  return <div className="signature-canvas"><canvas ref={canvas} width={960} height={300} aria-label={t('bookingEmail.signatureCanvas')} onPointerDown={e => draw(e, true)} onPointerMove={e => draw(e)} onPointerUp={finish} onPointerCancel={finish} /><button type="button" className="signature-clear" onClick={clear}>Borrar firma</button></div>
}

function RequestPreview({ data }: { data: FullRequest }) {
  const { t } = useTranslation()
  const optional = (value: string) => value.trim() || t('bookingEmail.notIndicated')
  const sections: [string, [string, string][]][] = [
    ['personal', [['patientType', data.tipoPaciente], ['name', data.nombre], ['email', data.email], ['phone', optional(data.administrativo.telefono)]]],
    ['request', [['availability', data.administrativo.preferenciaHoraria], ['channel', data.administrativo.canal]]],
    ['consultation', [['region', data.clinico.zona], ['duration', data.clinico.duracion], ['reason', data.clinico.motivo], ['pain', data.clinico.dolorActual === null ? t('bookingEmail.notIndicated') : `${data.clinico.dolorActual}/10`]]],
    ['health', [['history', optional(data.clinico.antecedentes)], ['medication', optional(data.clinico.medicacionAlergias)]]],
    ['consents', [['privacy', t('bookingEmail.yes')], ['healthConsent', t('bookingEmail.yes')], ['signatureKind', t(`bookingEmail.${data.firma.tipo === 'ESCRITA' ? 'written' : 'drawn'}`)]]],
    ['signature', [['signatureValue', data.firma.tipo === 'ESCRITA' ? data.firma.texto : t('bookingEmail.pngAttachment')]]],
  ]
  return <>{sections.map(([title, fields]) => <p key={title}><strong>{t(`bookingEmail.${title}`)}</strong><br />{fields.map(([label, value]) => <span key={label}>{t(`bookingEmail.${label}`)}: {value}<br /></span>)}</p>)}{data.firma.tipo === 'DIBUJADA' && <img src={data.firma.png} width={240} height={75} alt={t('bookingEmail.drawn')} />}</>
}

export function BookingDialog({ intent, onClose }: { intent: BookingIntent; onClose: () => void }) {
  const { t } = useTranslation()
  const [patient, setPatient] = useState(intent.patient)
  const [step, setStep] = useState<Step>(intent.patient === 'new' ? 'data' : intent.patient === 'returning' ? 'channel' : 'choose')
  const [values, setValues] = useState<Intake>(emptyIntake)
  const [returningContact, setReturningContact] = useState(emptyContact)
  const [errors, setErrors] = useState<Errors>({})
  const [signatureKind, setSignatureKind] = useState<'write' | 'draw'>('write')
  const [drawnSignature, setDrawnSignature] = useState('')
  const [completed, setCompleted] = useState(false)
  const [channel, setChannel] = useState<Channel | undefined>(intent.channel)
  const [copyStatus, setCopyStatus] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [fullFormDisabled, setFullFormDisabled] = useState(false)
  const [website, setWebsite] = useState('')
  const emailLocked = useRef(false)
  const emailRequestId = useRef<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const formStep = ['data', 'reason', 'consent'].indexOf(step) + 1
  const firstVisit = patient === 'new'
  const firstVisitEmail = firstVisit && completed && channel === 'email'
  const returningEmail = patient === 'returning' && channel === 'email'
  const emailFlow = firstVisitEmail || returningEmail
  const sending = emailStatus === 'sending'
  const stepHeading = step === 'preview'
    ? emailFlow
      ? [firstVisit ? 'bookingEmail.title' : 'bookingContact.title', firstVisit ? 'bookingEmail.previewText' : 'bookingContact.previewText']
      : ['bookingContact.whatsappPreviewTitle', 'bookingContact.whatsappPreviewText']
    : headings[step]

  useEffect(() => { heading.current?.focus({ preventScroll: true }); content.current?.scrollTo(0, 0) }, [step])

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    if (values[key] !== value) emailRequestId.current = null
    setValues(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }

  function changeStep(next: Step) { setErrors({}); setCopyStatus(''); setStep(next) }

  function choosePatient(next: 'new' | 'returning') {
    setPatient(next)
    setValues(emptyIntake())
    setReturningContact(emptyContact())
    setSignatureKind('write')
    setDrawnSignature('')
    setWebsite('')
    setCompleted(false)
    setEmailStatus('idle')
    setFullFormDisabled(false)
    emailLocked.current = false
    emailRequestId.current = null
    changeStep(next === 'new' ? 'data' : 'channel')
  }

  function updateContact<K extends keyof ReturnType<typeof emptyContact>>(key: K, value: ReturnType<typeof emptyContact>[K]) {
    if (returningContact[key] !== value) emailRequestId.current = null
    setReturningContact(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (step === 'returning-data') {
      if (returningContact.name.trim().length < 2) nextErrors.name = t('bookingContact.nameError')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(returningContact.email.trim())) nextErrors.email = t('bookingContact.emailError')
      if (!returningContact.privacy) nextErrors.privacy = t('bookingContact.privacyError')
    }
    if (step === 'data') {
      if (values.name.trim().length < 2) nextErrors.name = 'Escribe tu nombre y apellidos.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = 'Introduce un correo electrónico válido.'
      if (values.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(values.phone.trim())) nextErrors.phone = 'Revisa el número de teléfono.'
    }
    if (step === 'reason') {
      if (!values.region) nextErrors.region = 'Selecciona la zona de la consulta.'
      if (!values.duration) nextErrors.duration = 'Selecciona desde cuándo te ocurre.'
      if (values.reason.trim().length < 10) nextErrors.reason = 'Cuéntanos un poco más, al menos 10 caracteres.'
    }
    if (step === 'consent') {
      if (!values.privacy) nextErrors.privacy = 'Lee y acepta la información sobre privacidad.'
      if (!values.healthConsent) nextErrors.healthConsent = 'El consentimiento explícito es necesario para continuar.'
      if (signatureKind === 'write' ? values.signature.trim().length < 3 : !drawnSignature) nextErrors.signature = t('bookingEmail.signatureError')
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      const first = Object.keys(nextErrors)[0]
      document.getElementById(signatureKind === 'draw' && first === 'signature' ? 'signature-label' : first)?.focus()
      return
    }
    if (step === 'data') changeStep('reason')
    if (step === 'reason') changeStep('consent')
    if (step === 'consent') { setCompleted(true); changeStep('channel') }
    if (step === 'returning-data') changeStep('preview')
  }

  function back() {
    const previous: Record<Step, Step> = { choose: 'choose', data: 'choose', reason: 'data', consent: 'reason', channel: firstVisit && completed ? 'consent' : 'choose', 'returning-data': 'channel', preview: returningEmail ? 'returning-data' : 'channel' }
    changeStep(previous[step])
  }

  function fullRequest(): FullRequest {
    return {
      version: 2, tipoPaciente: 'NUEVO', nombre: values.name.trim(), email: values.email.trim(), website,
      administrativo: { telefono: values.phone.trim(), preferenciaHoraria: values.availability, canal: 'EMAIL' },
      clinico: {
        zona: values.region, duracion: values.duration, motivo: values.reason.trim(),
        dolorActual: values.pain === '' ? null : Number(values.pain),
        antecedentes: values.history.trim(), medicacionAlergias: values.medication.trim(),
      },
      consentimientos: { privacidad: values.privacy, salud: values.healthConsent },
      firma: signatureKind === 'write' ? { tipo: 'ESCRITA', texto: values.signature.trim() } : { tipo: 'DIBUJADA', png: drawnSignature },
    }
  }

  async function sendEmail() {
    if (!emailFlow || step !== 'preview' || emailLocked.current || (returningEmail && !returningContact.privacy)) return
    emailLocked.current = true
    setEmailStatus('sending')
    setFullFormDisabled(false)
    try {
      emailRequestId.current ??= crypto.randomUUID()
      const response = await fetch('/api/enviar-solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': emailRequestId.current },
        // Separate allowlists: returning patients never submit clinical state or signatures.
        body: JSON.stringify(firstVisitEmail ? fullRequest() : {
          tipoPaciente: 'HABITUAL', nombre: returningContact.name.trim(), email: returningContact.email.trim(), website,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const result: unknown = await response.json()
      if (response.status === 503 && typeof result === 'object' && result !== null
        && 'code' in result && result.code === 'FULL_FORM_DISABLED') setFullFormDisabled(true)
      if (!response.ok || typeof result !== 'object' || result === null
        || !('sent' in result) || result.sent !== true) throw new Error('Unconfirmed send')
      setEmailStatus('sent')
    } catch {
      emailLocked.current = false
      setEmailStatus('error')
    }
  }

  const input = (key: 'name' | 'email' | 'phone' | 'medication' | 'signature', options: { type?: string; placeholder?: string; autoComplete?: string; maxLength?: number } = {}) => <input id={key} className={`field-input ${key === 'signature' ? 'signature-input' : ''}`} value={values[key]} onChange={e => update(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} required={['name', 'email', 'signature'].includes(key)} maxLength={options.maxLength ?? 160} {...options} />
  const select = (key: 'availability' | 'region' | 'duration', options: string[]) => <select id={key} className="field-input field-select" value={values[key]} onChange={e => update(key, e.target.value)} required={key !== 'availability'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined}>{key !== 'availability' && <option value="">Elige una opción</option>}{options.map(option => <option key={option}>{option}</option>)}</select>
  const textArea = (key: 'reason' | 'history', placeholder: string) => <textarea id={key} className="field-input" rows={3} value={values[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} maxLength={1000} required={key === 'reason'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} />
  const message = `Hola, Reathlet. ${firstVisit && completed ? `Soy ${values.name.trim()} y me gustaría solicitar una primera visita.` : 'Ya soy paciente y me gustaría solicitar una nueva cita.'}${firstVisit && completed && values.availability !== 'Sin preferencia' ? ` Mi preferencia horaria es: ${values.availability.toLowerCase()}.` : ''} ¿Podemos hablar de la disponibilidad? Gracias.`

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopyStatus(t('bookingContact.copied')) }
    catch { setCopyStatus(t('bookingContact.copyError')) }
  }

  return <Modal onClose={onClose} closeDisabled={sending} className="booking-dialog" label="booking-title" closeLabel={t('common.closeForm')}>
    <div className="booking-heading"><span className="eyebrow">{t('booking.eyebrow')}</span><h2 ref={heading} id="booking-title" data-slot="dialog-title" tabIndex={-1}>{t(stepHeading[0])}</h2><p data-slot="dialog-description">{t(stepHeading[1])}</p></div>
    {formStep > 0 && <div className="form-progress"><div><span>Paso {formStep} de 3</span><span>{['Tus datos', 'Tu consulta', 'Consentimiento'][formStep - 1]}</span></div><div className="intake-progress" role="progressbar" aria-label={`Paso ${formStep} de 3`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(formStep / 3 * 100)}><div data-slot="progress-indicator" style={{ width: `${formStep / 3 * 100}%`, height: '100%' }} /></div></div>}
    <div ref={content} className="booking-content">
      <div className="demo-notice"><Icon name="lock" size={16} /><p><strong>{t(patient === 'returning' ? 'bookingContact.title' : 'bookingEmail.title')}</strong> {t(patient === 'returning' ? channel === 'whatsapp' ? 'bookingContact.whatsappNotice' : 'bookingContact.notice' : channel === 'whatsapp' ? 'bookingContact.firstVisitWhatsappNotice' : 'bookingEmail.notice')}</p></div>
      {step === 'choose' && <><div className="patient-choices"><button className="patient-choice" onClick={() => choosePatient('new')}><span className="choice-icon"><Icon name="clipboard" /></span><span><strong>{t('booking.firstVisit')}</strong><small>Un formulario breve para conocerte mejor.<br />Datos, motivo de consulta y consentimiento.</small></span><Icon name="right" size={22} /></button><button className="patient-choice" onClick={() => choosePatient('returning')}><span className="choice-icon"><Icon name="chat" /></span><span><strong>{t('booking.returning')}</strong><small>{t('bookingContact.returningDescription')}</small></span><Icon name="right" size={22} /></button></div><p className="booking-reassurance"><Icon name="shield" size={15} />Sin pagos. Sin compromiso. A tu ritmo.</p></>}
      {(formStep > 0 || step === 'returning-data') && <form id="intake-form" onSubmit={submit} noValidate>
        <div hidden aria-hidden="true"><input type="text" id="booking-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => { setWebsite(event.target.value); emailRequestId.current = null }} /></div>
        {Object.values(errors).some(Boolean) && <div className="error-summary" role="alert">{t('booking.formError')}</div>}
        {step === 'returning-data' && <>
          <Field id="name" label={t('bookingContact.nameLabel')} required error={errors.name}><input id="name" className="field-input" value={returningContact.name} onChange={e => updateContact('name', e.target.value)} autoComplete="name" maxLength={160} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} /></Field>
          <Field id="email" label={t('bookingEmail.email')} required error={errors.email}><input id="email" className="field-input" type="email" value={returningContact.email} onChange={e => updateContact('email', e.target.value)} autoComplete="email" maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} /></Field>
          <p className="privacy-brief">{t('bookingContact.privacyInfo')} <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">{t('bookingContact.privacyLink')}</a></p>
          <div className="consent-choice"><input id="privacy" type="checkbox" checked={returningContact.privacy} onChange={e => updateContact('privacy', e.target.checked)} required aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy ? 'privacy-error' : undefined} /><div><label htmlFor="privacy">{t('bookingContact.privacyLabel')} *</label>{errors.privacy && <span id="privacy-error" className="field-error">{errors.privacy}</span>}</div></div>
        </>}
        {step === 'data' && <>
          <h3 className="sr-only">Tus datos de contacto</h3>
          <Field id="name" label="Nombre y apellidos" required error={errors.name}>{input('name', { placeholder: 'Por ejemplo, Alex García', autoComplete: 'name', maxLength: 100 })}</Field>
          <div className="field-grid"><Field id="email" label="Correo electrónico" required error={errors.email}>{input('email', { type: 'email', placeholder: 'tu@email.com', autoComplete: 'email' })}</Field><Field id="phone" label="Teléfono" optional error={errors.phone}>{input('phone', { type: 'tel', placeholder: '+34', autoComplete: 'tel', maxLength: 20 })}</Field></div>
          <Field id="availability" label="¿Cuándo te suele venir bien?">{select('availability', availabilityOptions)}</Field>
          <p className="field-hint">Campos con * obligatorios. La disponibilidad es una preferencia, no una reserva.</p>
          <p className="privacy-brief">Responsable: Reathlet (titular pendiente de validar). Finalidad prevista: gestionar tu solicitud y preparar la valoración. Puedes consultar tus derechos en la <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</p>
        </>}
        {step === 'reason' && <>
          <h3 className="sr-only">Motivo de consulta</h3>
          <div className="field-grid"><Field id="region" label="¿Qué zona te preocupa?" required error={errors.region}>{select('region', regionOptions)}</Field><Field id="duration" label="¿Desde cuándo?" required error={errors.duration}>{select('duration', durationOptions)}</Field></div>
          <Field id="reason" label="¿Qué te ocurre y qué te gustaría recuperar?" required error={errors.reason}>{textArea('reason', 'Cuéntanos brevemente el motivo de tu consulta.')}</Field>
          <div className="pain-field"><div><label htmlFor="pain" className="field-label">Molestia actual <span className="optional">(orientativa)</span></label><strong>{values.pain === '' ? <small>{t('bookingEmail.notIndicated')}</small> : <>{values.pain}<small>/10</small></>}</strong></div><input id="pain" type="range" min="0" max="10" step="1" value={values.pain || '3'} onChange={e => update('pain', e.target.value)} onPointerDown={e => update('pain', e.currentTarget.value)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) update('pain', e.currentTarget.value) }} aria-valuetext={values.pain === '' ? t('bookingEmail.notIndicated') : `${values.pain}/10`} aria-describedby="pain-hint" /><div className="range-labels"><span>Sin molestias</span><span>Muy intensa</span></div><p id="pain-hint" className="field-hint">{t('bookingEmail.painHint')}</p><button type="button" className="text-button" onClick={() => update('pain', '')}>{t('bookingEmail.clearPain')}</button></div>
          <Field id="history" label="Lesiones, cirugías o antecedentes" optional>{textArea('history', 'Solo lo que consideres relevante.')}</Field>
          <Field id="medication" label="Medicación o alergias relevantes" optional>{input('medication', { placeholder: 'Si quieres, indícalo aquí.', maxLength: 300 })}</Field>
          <p className="field-hint">Este formulario no realiza diagnósticos ni sustituye una valoración profesional.</p>
        </>}
        {step === 'consent' && <>
          <h3 className="sr-only">Consentimiento y firma</h3>
          <div className="consent-info"><Icon name="shield" size={22} /><div><strong>Tú decides sobre tus datos.</strong><p>{t('bookingEmail.consentInfo')}</p></div></div>
          <div className="consent-choice"><input id="privacy" type="checkbox" checked={values.privacy} onChange={e => update('privacy', e.target.checked)} aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy ? 'privacy-error' : undefined} /><div><label htmlFor="privacy">He leído la información sobre privacidad. *</label><a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">Consultar la política de privacidad</a>{errors.privacy && <span id="privacy-error" className="field-error">{errors.privacy}</span>}</div></div>
          <div className="consent-choice"><input id="healthConsent" type="checkbox" checked={values.healthConsent} onChange={e => update('healthConsent', e.target.checked)} aria-invalid={Boolean(errors.healthConsent)} aria-describedby={errors.healthConsent ? 'healthConsent-error' : undefined} /><div><label htmlFor="healthConsent">Consiento de forma explícita el tratamiento de la información de salud que aporto para preparar mi primera valoración y gestionar esta solicitud. *</label>{errors.healthConsent && <span id="healthConsent-error" className="field-error">{errors.healthConsent}</span>}</div></div>
          <div className="signature-field"><span id="signature-label" tabIndex={-1} className="field-label">Tu firma <span aria-hidden="true">*</span></span><div className="signature-tabs" role="tablist" aria-label="Forma de firmar"><button id="signature-write-tab" type="button" role="tab" aria-controls="signature-panel" aria-selected={signatureKind === 'write'} onClick={() => { if (signatureKind !== 'write') emailRequestId.current = null; setSignatureKind('write') }}>Escribir firma</button><button id="signature-draw-tab" type="button" role="tab" aria-controls="signature-panel" aria-selected={signatureKind === 'draw'} onClick={() => { if (signatureKind !== 'draw') emailRequestId.current = null; setSignatureKind('draw') }}>Dibujar firma</button></div><div id="signature-panel" role="tabpanel" aria-labelledby={`signature-${signatureKind}-tab`}>{signatureKind === 'write' ? <Field id="signature" label="Nombre completo como firma">{input('signature', { placeholder: 'Tu nombre completo', autoComplete: 'off', maxLength: 100 })}</Field> : <SignatureDrawing value={drawnSignature} onChange={signature => { if (drawnSignature !== signature) emailRequestId.current = null; setDrawnSignature(signature); setErrors(previous => ({ ...previous, signature: undefined })) }} />}</div>{errors.signature && <span id="signature-error" className="field-error">{errors.signature}</span>}<p className="field-hint">{t('bookingEmail.signatureNotice')}</p></div>
          <p className="privacy-brief">Este consentimiento sobre datos no autoriza técnicas invasivas. Cualquier consentimiento asistencial específico se explica y recoge por separado.</p>
        </>}
      </form>}
      {step === 'channel' && <>
        {firstVisit && completed && <div className="intake-ready"><Icon name="check" size={20} /><span>{t('bookingEmail.ready')}</span><button className="text-button" onClick={() => changeStep('data')}>Revisar</button></div>}
        <h3 className="sr-only">{t('bookingContact.channelLabel')}</h3><div className="channel-options" role="group" aria-label={t('bookingContact.channelLabel')}>{(['whatsapp', 'email'] as const).map(option => <button key={option} className={`channel-card ${channel === option ? 'selected' : ''}`} aria-pressed={channel === option} onClick={() => { if (channel !== option) emailRequestId.current = null; setChannel(option) }}><Icon name={option === 'whatsapp' ? 'chat' : 'mail'} size={30} /><strong>{option === 'whatsapp' ? 'WhatsApp' : t('bookingEmail.email')}</strong><span>{t(`bookingContact.${option === 'whatsapp' ? 'whatsappDescription' : 'emailDescription'}`)}</span>{channel === option && <span className="channel-check"><Icon name="check" size={18} /></span>}</button>)}</div>
        <div className="channel-privacy"><Icon name="shield" size={16} /><p>{t(firstVisit ? 'bookingEmail.channelPrivacy' : 'bookingContact.channelPrivacy')}</p></div><p className="field-hint">WhatsApp: +34 611 53 79 27.<br />{t(firstVisit ? 'bookingEmail.channelHint' : 'bookingContact.channelHint')}</p>
      </>}
      {step === 'preview' && <>
        {emailFlow ? <>
          <div className="message-preview first-visit-email"><div className="message-preview-header"><Icon name="mail" size={23} /><div><strong>{t(firstVisitEmail ? 'bookingEmail.title' : 'bookingContact.title')}</strong><span>{t('bookingEmail.recipient')}</span></div><span className="demo-badge">{t('bookingEmail.testBadge')}</span></div><div className="message-body">{firstVisitEmail ? <RequestPreview data={fullRequest()} /> : <p><span>{t('bookingContact.nameLabel')}: {returningContact.name.trim()}</span><br /><span>{t('bookingEmail.email')}: {returningContact.email.trim()}</span></p>}<span>{t(firstVisitEmail ? 'bookingEmail.fullContents' : 'bookingContact.contents')}</span></div></div>
          <div className="preview-actions" aria-busy={sending}><button type="button" className="button button-primary" disabled={sending || emailStatus === 'sent'} onClick={sendEmail}><Icon name="mail" size={18} />{t(`bookingEmail.${emailStatus === 'sending' ? 'sending' : emailStatus === 'sent' ? 'sentButton' : emailStatus === 'error' ? 'retry' : 'send'}`)}</button>{!sending && <a className="button button-outline" href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} />{t('bookingEmail.whatsapp')}</a>}</div>
          <p className={emailStatus === 'error' ? 'error-summary' : 'field-hint'} role={emailStatus === 'error' ? 'alert' : 'status'}>{emailStatus === 'sending' ? t('bookingEmail.sending') : emailStatus === 'sent' ? t('bookingEmail.success') : emailStatus === 'error' ? t(`bookingEmail.${firstVisitEmail && fullFormDisabled ? 'disabled' : 'error'}`) : ''}</p>
        </> : <>
        <div className="message-preview whatsapp-preview"><div className="message-preview-header"><Icon name="chat" size={23} /><div><strong>{t('bookingContact.whatsappTitle')}</strong><span>+34 611 53 79 27</span></div></div><div className="message-body"><p>{message}</p><span>{t('bookingContact.whatsappNotice')}</span></div></div>
        <div className="preview-actions"><button className="button button-outline" onClick={copyMessage}><Icon name="copy" size={18} />{t('bookingContact.copy')}</button><a className="button button-primary" href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} />{t('bookingContact.openWhatsapp')}</a></div><p className="field-hint" role="status">{copyStatus}</p>
        </>}
        <div className="preview-summary"><Icon name="calendar" size={22} /><div><strong>{t('bookingContact.summaryTitle')}</strong><p>{t('bookingContact.summaryText')}</p></div></div>
      </>}
    </div>
    <div className="booking-footer">{step === 'choose' ? <><span><Icon name="shield" size={15} />Tu información, con cuidado</span><button className="text-button" onClick={onClose}>{t('booking.explore')}</button></> : <><button className="back-button" disabled={sending || (emailFlow && emailStatus === 'sent')} onClick={back}>{t('booking.back')}</button>{formStep > 0 || step === 'returning-data' ? <button className="button button-primary" type="submit" form="intake-form">{step === 'consent' ? 'Firmar y continuar' : step === 'returning-data' ? t('bookingContact.review') : t('booking.next')}</button> : step === 'channel' ? <button className="button button-primary" disabled={!channel} onClick={() => changeStep(returningEmail ? 'returning-data' : 'preview')}>{t(returningEmail ? 'booking.next' : 'bookingContact.review')}</button> : <button className="button button-primary" disabled={sending} onClick={onClose}>{t('booking.finish')}</button>}</>}</div>
  </Modal>
}
