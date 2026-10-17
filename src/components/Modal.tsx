import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ children, onClose, className = '', label, closeLabel = 'Cerrar formulario', closeDisabled = false }: { children: ReactNode; onClose: () => void; className?: string; label: string; closeLabel?: string; closeDisabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={ref} className={`modal-frame ${className}`} aria-labelledby={label} onCancel={e => { e.preventDefault(); if (!closeDisabled) onClose() }} onClick={e => { if (!closeDisabled && e.target === e.currentTarget) { const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose() } }}>
    <button type="button" className="dialog-close icon-button" disabled={closeDisabled} aria-label={closeLabel} onClick={onClose}><Icon name="close" size={20} /></button>
    {children}
  </dialog>
}
