import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent, ReactNode } from 'react'
import { contact } from '../data'
import { Icon } from './Icon'
import { Modal } from './Modal'

type Channel = 'whatsapp' | 'email'
export type BookingIntent = { patient?: 'new' | 'returning'; channel?: Channel }
type Step = 'choose' | 'data' | 'reason' | 'consent' | 'channel' | 'preview'
type Intake = { name: string; email: string; phone: string; availability: string; region: string; duration: string; reason: string; pain: string; history: string; medication: string; signature: string; privacy: boolean; healthConsent: boolean }
type Errors = Partial<Record<keyof Intake, string>>

const headings: Record<Step, [string, string]> = {
  choose: ['¿Nos conocemos?', 'Elige la opción que mejor te representa.'],
  data: ['Empezamos por ti.', 'Solo lo necesario para preparar tu primer contacto.'],
  reason: ['Cuéntanos un poquito.', 'No hace falta un diagnóstico. Cuéntanos qué te gustaría recuperar.'],
  consent: ['Tu tranquilidad importa.', 'Lee la información y firma para continuar.'],
  channel: ['¿Cómo prefieres hablar?', 'La clínica te confirmará disponibilidad y precio.'],
  preview: ['Tu primer paso, preparado.', 'Esta solicitud es una demostración. Tú decides cómo continuar.'],
}

function Field({ id, label, children, error, required = false, optional = false }: { id: string; label: string; children: ReactNode; error?: string; required?: boolean; optional?: boolean }) {
  return <div className="field"><label htmlFor={id} className="field-label">{label} {required && <span aria-hidden="true">*</span>}{optional && <span className="optional">(opcional)</span>}</label>{children}{error && <span id={`${id}-error`} className="field-error">{error}</span>}</div>
}

function SignatureDrawing({ value, onChange }: { value: string; onChange: (signature: string) => void }) {
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

  return <div className="signature-canvas"><canvas ref={canvas} width={960} height={300} aria-label="Área para dibujar tu firma de demostración. También puedes utilizar Escribir firma." onPointerDown={e => draw(e, true)} onPointerMove={e => draw(e)} onPointerUp={finish} onPointerCancel={finish} /><button type="button" className="signature-clear" onClick={clear}>Borrar firma</button></div>
}

export function BookingDialog({ intent, onClose }: { intent: BookingIntent; onClose: () => void }) {
  const [step, setStep] = useState<Step>(intent.patient === 'new' ? 'data' : intent.patient === 'returning' ? 'channel' : 'choose')
  const [values, setValues] = useState<Intake>({ name: '', email: '', phone: '', availability: 'Sin preferencia', region: '', duration: '', reason: '', pain: '3', history: '', medication: '', signature: '', privacy: false, healthConsent: false })
  const [errors, setErrors] = useState<Errors>({})
  const [signatureKind, setSignatureKind] = useState<'write' | 'draw'>('write')
  const [drawnSignature, setDrawnSignature] = useState('')
  const [completed, setCompleted] = useState(false)
  const [channel, setChannel] = useState<Channel | undefined>(intent.channel)
  const [copyStatus, setCopyStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const formStep = ['data', 'reason', 'consent'].indexOf(step) + 1

  useEffect(() => { heading.current?.focus({ preventScroll: true }); content.current?.scrollTo(0, 0) }, [step])

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    setValues(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }

  function changeStep(next: Step) { setErrors({}); setCopyStatus(''); setStep(next) }

  function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Errors = {}
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
      if (signatureKind === 'write' ? values.signature.trim().length < 3 : !drawnSignature) nextErrors.signature = 'Escribe tu nombre completo o dibuja tu firma de prueba.'
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
  }

  function back() {
    const previous: Record<Step, Step> = { choose: 'choose', data: 'choose', reason: 'data', consent: 'reason', channel: completed ? 'consent' : 'choose', preview: 'channel' }
    changeStep(previous[step])
  }

  const input = (key: 'name' | 'email' | 'phone' | 'medication' | 'signature', options: { type?: string; placeholder?: string; autoComplete?: string; maxLength?: number } = {}) => <input id={key} className={`field-input ${key === 'signature' ? 'signature-input' : ''}`} value={values[key]} onChange={e => update(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} required={['name', 'email', 'signature'].includes(key)} maxLength={options.maxLength ?? 160} {...options} />
  const select = (key: 'availability' | 'region' | 'duration', options: string[]) => <select id={key} className="field-input field-select" value={values[key]} onChange={e => update(key, e.target.value)} required={key !== 'availability'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined}>{key !== 'availability' && <option value="">Elige una opción</option>}{options.map(option => <option key={option}>{option}</option>)}</select>
  const textArea = (key: 'reason' | 'history', placeholder: string) => <textarea id={key} className="field-input" rows={3} value={values[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} maxLength={1000} required={key === 'reason'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} />
  const message = `Hola, Reathlet. ${completed ? `Soy ${values.name.trim()} y me gustaría solicitar una primera visita.` : 'Ya soy paciente y me gustaría solicitar una nueva cita.'}${completed && values.availability !== 'Sin preferencia' ? ` Mi preferencia horaria es: ${values.availability.toLowerCase()}.` : ''} ¿Podemos hablar de la disponibilidad? Gracias.`

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopyStatus('Mensaje copiado.') }
    catch { setCopyStatus('No se pudo copiar automáticamente. Puedes seleccionar y copiar el mensaje.') }
  }

  return <Modal onClose={onClose} className="booking-dialog" label="booking-title">
    <div className="booking-heading"><span className="eyebrow">REATHLET · CONTIGO DESDE EL PRINCIPIO</span><h2 ref={heading} id="booking-title" data-slot="dialog-title" tabIndex={-1}>{headings[step][0]}</h2><p data-slot="dialog-description">{headings[step][1]}</p></div>
    {formStep > 0 && <div className="form-progress"><div><span>Paso {formStep} de 3</span><span>{['Tus datos', 'Tu consulta', 'Consentimiento'][formStep - 1]}</span></div><div className="intake-progress" role="progressbar" aria-label={`Paso ${formStep} de 3`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(formStep / 3 * 100)}><div data-slot="progress-indicator" style={{ width: `${formStep / 3 * 100}%`, height: '100%' }} /></div></div>}
    <div ref={content} className="booking-content">
      <div className="demo-notice"><Icon name="lock" size={16} /><p><strong>Prueba con datos ficticios.</strong> Esta demo no guarda datos de salud ni firmas y no crea citas reales.</p></div>
      {step === 'choose' && <><div className="patient-choices"><button className="patient-choice" onClick={() => changeStep('data')}><span className="choice-icon"><Icon name="clipboard" /></span><span><strong>Es mi primera visita</strong><small>Un formulario breve para conocerte mejor.<br />Datos, motivo de consulta y consentimiento.</small></span><Icon name="right" size={22} /></button><button className="patient-choice" onClick={() => changeStep('channel')}><span className="choice-icon"><Icon name="chat" /></span><span><strong>Ya soy paciente</strong><small>Contacta para pedir una nueva cita.</small></span><Icon name="right" size={22} /></button></div><p className="booking-reassurance"><Icon name="shield" size={15} />Sin pagos. Sin compromiso. A tu ritmo.</p></>}
      {formStep > 0 && <form id="intake-form" onSubmit={submit} noValidate>
        {Object.values(errors).some(Boolean) && <div className="error-summary" role="alert">Revisa los campos marcados antes de continuar.</div>}
        {step === 'data' && <>
          <h3 className="sr-only">Tus datos de contacto</h3>
          <Field id="name" label="Nombre y apellidos" required error={errors.name}>{input('name', { placeholder: 'Por ejemplo, Alex García', autoComplete: 'name', maxLength: 100 })}</Field>
          <div className="field-grid"><Field id="email" label="Correo electrónico" required error={errors.email}>{input('email', { type: 'email', placeholder: 'tu@email.com', autoComplete: 'email' })}</Field><Field id="phone" label="Teléfono" optional error={errors.phone}>{input('phone', { type: 'tel', placeholder: '+34', autoComplete: 'tel', maxLength: 20 })}</Field></div>
          <Field id="availability" label="¿Cuándo te suele venir bien?">{select('availability', ['Sin preferencia', 'Por la mañana', 'Al mediodía', 'Por la tarde'])}</Field>
          <p className="field-hint">Campos con * obligatorios. La disponibilidad es una preferencia, no una reserva.</p>
          <p className="privacy-brief">Responsable: Reathlet (titular pendiente de validar). Finalidad prevista: gestionar tu solicitud y preparar la valoración. Puedes consultar tus derechos en la <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</p>
        </>}
        {step === 'reason' && <>
          <h3 className="sr-only">Motivo de consulta</h3>
          <div className="field-grid"><Field id="region" label="¿Qué zona te preocupa?" required error={errors.region}>{select('region', ['Cuello / cervicales', 'Hombro / brazo', 'Espalda / zona lumbar', 'Cadera', 'Rodilla', 'Tobillo / pie', 'Varias zonas', 'Valoración general'])}</Field><Field id="duration" label="¿Desde cuándo?" required error={errors.duration}>{select('duration', ['Menos de una semana', 'Entre 1 y 4 semanas', 'Entre 1 y 3 meses', 'Más de 3 meses', 'No tengo molestias actualmente'])}</Field></div>
          <Field id="reason" label="¿Qué te ocurre y qué te gustaría recuperar?" required error={errors.reason}>{textArea('reason', 'Cuéntanos brevemente el motivo de tu consulta.')}</Field>
          <div className="pain-field"><div><label htmlFor="pain" className="field-label">Molestia actual <span className="optional">(orientativa)</span></label><strong>{values.pain}<small>/10</small></strong></div><input id="pain" type="range" min="0" max="10" step="1" value={values.pain} onChange={e => update('pain', e.target.value)} /><div className="range-labels"><span>Sin molestias</span><span>Muy intensa</span></div></div>
          <Field id="history" label="Lesiones, cirugías o antecedentes" optional>{textArea('history', 'Solo lo que consideres relevante.')}</Field>
          <Field id="medication" label="Medicación o alergias relevantes" optional>{input('medication', { placeholder: 'Si quieres, indícalo aquí.', maxLength: 300 })}</Field>
          <p className="field-hint">Este formulario no realiza diagnósticos ni sustituye una valoración profesional.</p>
        </>}
        {step === 'consent' && <>
          <h3 className="sr-only">Consentimiento y firma</h3>
          <div className="consent-info"><Icon name="shield" size={22} /><div><strong>Tú decides sobre tus datos.</strong><p>El uso previsto del formulario es preparar tu primera consulta. La versión real deberá conservar de forma segura la información y la evidencia del consentimiento. Aquí todo permanece solo en memoria y se borra al cerrar.</p></div></div>
          <div className="consent-choice"><input id="privacy" type="checkbox" checked={values.privacy} onChange={e => update('privacy', e.target.checked)} aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy ? 'privacy-error' : undefined} /><div><label htmlFor="privacy">He leído la información sobre privacidad. *</label><a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">Consultar la política de privacidad</a>{errors.privacy && <span id="privacy-error" className="field-error">{errors.privacy}</span>}</div></div>
          <div className="consent-choice"><input id="healthConsent" type="checkbox" checked={values.healthConsent} onChange={e => update('healthConsent', e.target.checked)} aria-invalid={Boolean(errors.healthConsent)} aria-describedby={errors.healthConsent ? 'healthConsent-error' : undefined} /><div><label htmlFor="healthConsent">Consiento de forma explícita el tratamiento de la información de salud que aporto para preparar mi primera valoración y gestionar esta solicitud. *</label>{errors.healthConsent && <span id="healthConsent-error" className="field-error">{errors.healthConsent}</span>}</div></div>
          <div className="signature-field"><span id="signature-label" tabIndex={-1} className="field-label">Tu firma <span aria-hidden="true">*</span></span><div className="signature-tabs" role="tablist" aria-label="Forma de firmar"><button id="signature-write-tab" type="button" role="tab" aria-controls="signature-panel" aria-selected={signatureKind === 'write'} onClick={() => setSignatureKind('write')}>Escribir firma</button><button id="signature-draw-tab" type="button" role="tab" aria-controls="signature-panel" aria-selected={signatureKind === 'draw'} onClick={() => setSignatureKind('draw')}>Dibujar firma</button></div><div id="signature-panel" role="tabpanel" aria-labelledby={`signature-${signatureKind}-tab`}>{signatureKind === 'write' ? <Field id="signature" label="Nombre completo como firma">{input('signature', { placeholder: 'Tu nombre completo', autoComplete: 'off', maxLength: 100 })}</Field> : <SignatureDrawing value={drawnSignature} onChange={signature => { setDrawnSignature(signature); setErrors(previous => ({ ...previous, signature: undefined })) }} />}</div>{errors.signature && <span id="signature-error" className="field-error">{errors.signature}</span>}<p className="field-hint">Firma de demostración. No genera un consentimiento legal registrado.</p></div>
          <p className="privacy-brief">Este consentimiento sobre datos no autoriza técnicas invasivas. Cualquier consentimiento asistencial específico se explica y recoge por separado.</p>
        </>}
      </form>}
      {step === 'channel' && <>
        {completed && <div className="intake-ready"><Icon name="check" size={20} /><span>Formulario de prueba completado.</span><button className="text-button" onClick={() => changeStep('data')}>Revisar</button></div>}
        <h3 className="sr-only">Elegir canal de contacto</h3><div className="channel-options" role="group" aria-label="Canal de contacto">{(['whatsapp', 'email'] as const).map(option => <button key={option} className={`channel-card ${channel === option ? 'selected' : ''}`} aria-pressed={channel === option} onClick={() => setChannel(option)}><Icon name={option === 'whatsapp' ? 'chat' : 'mail'} size={30} /><strong>{option === 'whatsapp' ? 'WhatsApp' : 'Correo electrónico'}</strong><span>{option === 'whatsapp' ? 'Una conversación más cercana' : 'Consulta cuando te venga bien'}</span>{channel === option && <span className="channel-check"><Icon name="check" size={18} /></span>}</button>)}</div>
        <div className="channel-privacy"><Icon name="shield" size={16} /><p>El mensaje solo incluye una solicitud de cita. Los antecedentes, las molestias y la firma no se añaden a WhatsApp ni al correo.</p></div><p className="field-hint">WhatsApp: número pendiente de configurar.<br />Correo: {contact.email}</p>
      </>}
      {step === 'preview' && <>
        <div className={`message-preview ${channel === 'whatsapp' ? 'whatsapp-preview' : ''}`}><div className="message-preview-header"><Icon name={channel === 'whatsapp' ? 'chat' : 'mail'} size={23} /><div><strong>{channel === 'whatsapp' ? 'Tu mensaje de WhatsApp' : 'Tu correo para Reathlet'}</strong><span>{channel === 'whatsapp' ? 'Número pendiente de configurar' : contact.email}</span></div><span className="demo-badge">DEMO</span></div><div className="message-body"><p>{message}</p><span>Vista previa · No se ha enviado ningún mensaje</span></div></div>
        <div className="preview-actions"><button className="button button-outline" onClick={copyMessage}><Icon name="copy" size={18} />Copiar mensaje</button>{channel === 'email' && <a className="button button-primary" href={`mailto:${contact.email}?subject=${encodeURIComponent('Solicitud de cita · Reathlet')}&body=${encodeURIComponent(message)}`}><Icon name="mail" size={18} />Abrir borrador de correo</a>}</div><p className="field-hint" role="status">{copyStatus}</p>
        <div className="preview-summary"><Icon name="calendar" size={22} /><div><strong>La clínica confirmará tu cita.</strong><p>La disponibilidad, duración y precio se acuerdan en el primer contacto. En esta versión no se realiza ninguna reserva.</p></div></div>
      </>}
    </div>
    <div className="booking-footer">{step === 'choose' ? <><span><Icon name="shield" size={15} />Tu información, con cuidado</span><button className="text-button" onClick={onClose}>Seguir explorando</button></> : <><button className="back-button" onClick={back}>Atrás</button>{formStep > 0 ? <button className="button button-primary" type="submit" form="intake-form">{step === 'consent' ? 'Firmar y continuar' : 'Continuar'}</button> : step === 'channel' ? <button className="button button-primary" disabled={!channel} onClick={() => changeStep('preview')}>Ver mi solicitud</button> : <button className="button button-primary" onClick={onClose}>Volver a la web</button>}</>}</div>
  </Modal>
}
