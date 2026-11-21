import { useEffect, useRef } from 'react'
import './dialog.css'

export default function Dialog({ children, onDismiss, initialFocusRef, ...props }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.documentElement.style.overflow
    dialog.showModal()
    document.documentElement.style.overflow = 'hidden'
    initialFocusRef?.current?.focus()

    return () => {
      dialog.close()
      document.documentElement.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [initialFocusRef])

  function containFocus(event) {
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
      .filter((element) => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return <dialog ref={dialogRef} className="dialog" aria-modal="true" onKeyDown={containFocus} onCancel={(event) => {
    event.preventDefault()
    onDismiss()
  }} {...props}>{children}</dialog>
}
