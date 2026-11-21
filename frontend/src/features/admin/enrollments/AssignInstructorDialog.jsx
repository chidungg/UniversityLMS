import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { assignPreviewInstructor, enrollmentErrorMessage, validateInstructorSelection } from './enrollmentPreview'

const MAX_VISIBLE_OPTIONS = 25

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function AssignInstructorDialog({ classItem, course, currentInstructor, users, onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const searchRef = useRef(null)
  const summaryRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  useEffect(() => () => request.current?.abort(), [])

  const trimmed = search.trim().toLowerCase()
  const candidates = users
    .filter((user) => {
      if (!trimmed) return user.role === 'Instructor'
      return `${user.name} ${user.email}`.toLowerCase().includes(trimmed)
    })
    .map((user) => {
      const isCurrent = classItem.instructorId === user.id
      const isInstructor = user.role === 'Instructor'
      const isActive = user.status === 'Active'
      const eligible = isInstructor && isActive && !isCurrent
      return { user, isCurrent, isInstructor, isActive, eligible }
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return a.user.name.localeCompare(b.user.name, 'en', { sensitivity: 'base' })
    })

  const visibleCandidates = candidates.slice(0, MAX_VISIBLE_OPTIONS)
  const eligibleCount = candidates.filter((entry) => entry.eligible).length
  const selectedStillVisible = candidates.some((entry) => entry.eligible && entry.user.id === selectedId)
  const effectiveSelectedId = selectedStillVisible ? selectedId : ''
  const isChange = Boolean(classItem.instructorId)

  function close() {
    request.current?.abort()
    onClose()
  }

  function showValidation(errorText) {
    setFieldError(errorText)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  function resolveMissingSelectionError() {
    if (trimmed && !candidates.length) return `User not found. No account matches “${search.trim()}”.`
    if (candidates.length && eligibleCount === 0) {
      if (candidates.some((entry) => entry.isCurrent && entry.isInstructor && entry.isActive)) {
        return `This instructor is already assigned to ${classItem.code}.`
      }
      return 'Invalid assignment. Only active accounts with the Instructor role can be assigned to a class.'
    }
    return 'Select an active instructor to assign.'
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    setMessage('')
    if (!effectiveSelectedId) {
      showValidation(resolveMissingSelectionError())
      return
    }
    const validation = validateInstructorSelection(classItem, effectiveSelectedId, users)
    if (validation) {
      showValidation(validation)
      return
    }
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await assignPreviewInstructor(classItem.id, effectiveSelectedId, { signal: controller.signal })
      onSaved(result, `${result.instructor.name} assigned to ${result.classItem.code} in this preview.`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(enrollmentErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return <Dialog initialFocusRef={searchRef} onDismiss={close} aria-labelledby="assign-instructor-title" aria-describedby="assign-instructor-description">
    <header className="dialog-header">
      <div>
        <p className="dialog-eyebrow">INSTRUCTOR ASSIGNMENT</p>
        <h2 id="assign-instructor-title">{isChange ? 'Change instructor' : 'Assign instructor'}</h2>
      </div>
      <button type="button" className="dialog-close" aria-label="Close instructor assignment dialog" onClick={close}><Icon name="close" /></button>
    </header>
    <form noValidate onSubmit={submit} aria-busy={busy}>
      <div className="dialog-body user-form">
        <div className="user-confirm-identity">
          <strong>{classItem.code}</strong>
          <span>{course ? `${course.code} · ${course.name}` : 'Course unavailable'}{currentInstructor ? ` · Current: ${currentInstructor.name}` : ''}</span>
        </div>
        <p id="assign-instructor-description">Choose an active instructor to lead this class. Only accounts with the Instructor role can be assigned.</p>
        {fieldError && <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert"><strong>Please review your selection:</strong><ul><li><a href="#assign-instructor-search" onClick={(event) => { event.preventDefault(); searchRef.current?.focus() }}>{fieldError}</a></li></ul></div>}
        <div className="user-field">
          <label htmlFor="assign-instructor-search">Find instructor</label>
          <div className="user-search-control">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              id="assign-instructor-search"
              type="search"
              autoComplete="off"
              value={search}
              disabled={busy}
              placeholder="Search by instructor name or email…"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'assign-instructor-error' : 'assign-instructor-help'}
              onChange={(event) => { setSearch(event.target.value); setFieldError(''); setMessage('') }}
            />
          </div>
          <p id="assign-instructor-help" className="user-field-help">Search by full name or email. Non-instructor or inactive accounts cannot be assigned.</p>
          {fieldError && <p id="assign-instructor-error" className="user-field-error">{fieldError}</p>}
        </div>
        <fieldset className="enroll-picker-fieldset" disabled={busy}>
          <legend className="sr-only">Matching accounts for instructor assignment</legend>
          <div className="enroll-picker-meta" role="status" aria-atomic="true">
            <span>{candidates.length ? `${eligibleCount} eligible ${eligibleCount === 1 ? 'instructor' : 'instructors'} available` : 'No matching users'}</span>
            {trimmed && <button type="button" className="admin-row-link" onClick={() => { setSearch(''); setFieldError(''); searchRef.current?.focus() }}>Clear search</button>}
          </div>
          {visibleCandidates.length ? <>
            <ul className="enroll-picker-list">
              {visibleCandidates.map(({ user, isCurrent, isInstructor, isActive, eligible }) => (
                <li key={user.id}>
                  {eligible ? (
                    <label className={`enroll-option ${effectiveSelectedId === user.id ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="assign-instructor-id"
                        value={user.id}
                        checked={effectiveSelectedId === user.id}
                        onChange={() => { setSelectedId(user.id); setFieldError(''); setMessage('') }}
                      />
                      <span className="user-initials is-instructor" aria-hidden="true">{initials(user.name)}</span>
                      <span className="enroll-option-body">
                        <span className="enroll-option-top"><strong>{user.name}</strong></span>
                        <span className="enroll-option-email">{user.email}</span>
                      </span>
                    </label>
                  ) : (
                    <div className="enroll-option is-unavailable">
                      <span className={`user-initials ${user.role === 'Instructor' ? 'is-instructor' : ''}`} aria-hidden="true">{initials(user.name)}</span>
                      <div className="enroll-option-body">
                        <div className="enroll-option-top">
                          <strong>{user.name}</strong>
                          <span className={`enroll-tag ${isCurrent ? 'is-enrolled' : ''}`}>
                            {isCurrent ? 'Currently assigned' : !isInstructor ? user.role : 'Inactive'}
                          </span>
                        </div>
                        <span className="enroll-option-email">{user.email}</span>
                        <span className={`enroll-option-reason ${!isCurrent || !isInstructor || !isActive ? 'is-warning' : ''}`}>
                          {!isInstructor
                            ? 'Invalid assignment — only accounts with the Instructor role can be assigned.'
                            : !isActive
                              ? 'Invalid assignment — activate this instructor in User management first.'
                              : `Already assigned to ${classItem.code}.`}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {candidates.length > MAX_VISIBLE_OPTIONS && (
              <p className="enroll-picker-overflow">Showing the first {MAX_VISIBLE_OPTIONS} of {candidates.length} matching accounts. Refine your search to find a specific instructor.</p>
            )}
          </> : (
            <div className="enroll-picker-empty">
              <Icon name="search" size={24} />
              <strong>No user found</strong>
              <p>{trimmed ? `No account matches “${search.trim()}”. Check the name or email, or add an instructor in User management.` : 'No instructor accounts are available in this workspace yet.'}</p>
            </div>
          )}
        </fieldset>
        <div className="user-info">
          <Icon name="instructor" size={20} />
          <p>Changes are saved in this browser tab only. No live teaching assignments are modified.</p>
        </div>
        {message && <p className="user-error-summary" role="alert">{message}</p>}
        <span className="sr-only" role="status">{busy ? 'Saving instructor assignment.' : ''}</span>
      </div>
      <footer className="dialog-actions">
        <button type="button" className="secondary-button" onClick={close}>Cancel</button>
        <button type="submit" className="admin-button user-primary" disabled={busy}>{busy ? 'Saving…' : isChange ? 'Save assignment' : 'Assign instructor'}</button>
      </footer>
    </form>
  </Dialog>
}
