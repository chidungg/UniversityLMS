import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import {
  assignInstructor,
  enrollmentErrorMessage,
  listEnrollmentCandidates,
  validateInstructorSelection,
} from './enrollmentPreview'

const MAX_VISIBLE_OPTIONS = 25

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function AssignInstructorDialog({ selectedItem, currentInstructor, authenticated = false, preview = false, onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const searchRef = useRef(null)
  const summaryRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)

  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoadingCandidates(true)
      setLoadError('')
      listEnrollmentCandidates(selectedItem.id, 'instructor', search, {
        signal: controller.signal,
        authenticated,
      })
        .then((res) => {
          setCandidates(res.candidates || [])
          setLoadingCandidates(false)
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          setLoadError(enrollmentErrorMessage(error, true))
          setLoadingCandidates(false)
        })
    }, search ? 150 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [selectedItem.id, search, authenticated])

  const trimmed = search.trim().toLowerCase()
  const visibleCandidates = candidates.slice(0, MAX_VISIBLE_OPTIONS)
  const eligibleCount = candidates.filter((entry) => entry.eligible).length
  const selectedCandidate = candidates.find((entry) => entry.eligible && entry.user.id === selectedId) || null
  const effectiveSelectedId = selectedCandidate ? selectedCandidate.user.id : ''
  const isChange = Boolean(selectedItem.instructorId)
  const unitSingular = preview ? 'class' : 'course'

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
      if (candidates.some((entry) => entry.isCurrent && entry.isTargetRole && entry.isActive)) {
        return `This instructor is already assigned to ${selectedItem.code}.`
      }
      return `Invalid assignment. Only active accounts with the Instructor role can be assigned to a ${unitSingular}.`
    }
    return 'Select an active instructor to assign.'
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || loadingCandidates) return
    setMessage('')
    if (!effectiveSelectedId) {
      showValidation(resolveMissingSelectionError())
      return
    }
    const validation = validateInstructorSelection(selectedItem, selectedCandidate, preview)
    if (validation) {
      showValidation(validation)
      return
    }
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await assignInstructor(selectedItem.id, effectiveSelectedId, {
        signal: controller.signal,
        authenticated,
      })
      const suffix = result.preview ? ' in this preview.' : '.'
      onSaved(result, `${result.instructor.name} assigned to ${result.selectedItem.code}${suffix}`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(enrollmentErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog initialFocusRef={searchRef} onDismiss={close} aria-labelledby="assign-instructor-title" aria-describedby="assign-instructor-description">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">INSTRUCTOR ASSIGNMENT</p>
          <h2 id="assign-instructor-title">{isChange ? 'Change instructor' : 'Assign instructor'}</h2>
        </div>
        <button type="button" className="dialog-close" aria-label="Close instructor assignment dialog" onClick={close}>
          <Icon name="close" />
        </button>
      </header>
      <form noValidate onSubmit={submit} aria-busy={busy || loadingCandidates}>
        <div className="dialog-body user-form">
          <div className="user-confirm-identity">
            <strong>{selectedItem.code}</strong>
            <span>{selectedItem.name}{currentInstructor ? ` · Current: ${currentInstructor.name}` : ''}</span>
          </div>
          <p id="assign-instructor-description">
            Choose an active instructor to lead this {unitSingular}. Only accounts with the Instructor role can be assigned.
          </p>
          {fieldError && (
            <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert">
              <strong>Please review your selection:</strong>
              <ul>
                <li>
                  <a href="#assign-instructor-search" onClick={(event) => { event.preventDefault(); searchRef.current?.focus() }}>
                    {fieldError}
                  </a>
                </li>
              </ul>
            </div>
          )}
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
            <p id="assign-instructor-help" className="user-field-help">
              Search by full name or email. Non-instructor or inactive accounts cannot be assigned.
            </p>
            {fieldError && <p id="assign-instructor-error" className="user-field-error">{fieldError}</p>}
          </div>

          <fieldset className="enroll-picker-fieldset" disabled={busy}>
            <legend className="sr-only">Matching accounts for instructor assignment</legend>
            <div className="enroll-picker-meta" role="status" aria-atomic="true">
              <span>
                {loadingCandidates
                  ? 'Searching available instructors…'
                  : candidates.length
                    ? `${eligibleCount} eligible ${eligibleCount === 1 ? 'instructor' : 'instructors'} available`
                    : 'No matching users'}
              </span>
              {trimmed && (
                <button type="button" className="admin-row-link" onClick={() => { setSearch(''); setFieldError(''); searchRef.current?.focus() }}>
                  Clear search
                </button>
              )}
            </div>

            {loadError ? (
              <div className="user-error-summary" role="alert">
                <strong>Unable to load instructor list</strong>
                <p>{loadError}</p>
              </div>
            ) : loadingCandidates ? (
              <div className="enroll-picker-loading" role="status">
                <Icon name="refresh" size={18} className="admin-spinning" />
                <span>Loading instructors…</span>
              </div>
            ) : visibleCandidates.length ? (
              <>
                <ul className="enroll-picker-list">
                  {visibleCandidates.map(({ user, isCurrent, isTargetRole, isActive, eligible }) => (
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
                          <span className={`user-initials ${user.role === 'Instructor' ? 'is-instructor' : ''}`} aria-hidden="true">
                            {initials(user.name)}
                          </span>
                          <div className="enroll-option-body">
                            <div className="enroll-option-top">
                              <strong>{user.name}</strong>
                              <span className={`enroll-tag ${isCurrent ? 'is-enrolled' : ''}`}>
                                {isCurrent ? 'Currently assigned' : !isTargetRole ? user.role : 'Inactive'}
                              </span>
                            </div>
                            <span className="enroll-option-email">{user.email}</span>
                            <span className="enroll-option-reason is-warning">
                              {!isTargetRole
                                ? 'Invalid assignment — only accounts with the Instructor role can be assigned.'
                                : !isActive
                                  ? 'Invalid assignment — activate this instructor in User management first.'
                                  : `Already assigned to ${selectedItem.code}.`}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {candidates.length > MAX_VISIBLE_OPTIONS && (
                  <p className="enroll-picker-overflow">
                    Showing the first {MAX_VISIBLE_OPTIONS} of {candidates.length} matching accounts. Refine your search to find a specific instructor.
                  </p>
                )}
              </>
            ) : (
              <div className="enroll-picker-empty">
                <Icon name="search" size={24} />
                <strong>No user found</strong>
                <p>
                  {trimmed
                    ? `No account matches “${search.trim()}”. Check the name or email, or add an instructor in User management.`
                    : 'No instructor accounts are available in this workspace yet.'}
                </p>
              </div>
            )}
          </fieldset>

          <div className="user-info">
            <Icon name="instructor" size={20} />
            <p>
              {preview
                ? 'Changes are saved in this browser tab only. No live teaching assignments are modified.'
                : 'Instructor assignment takes effect immediately for this course.'}
            </p>
          </div>
          {message && <p className="user-error-summary" role="alert">{message}</p>}
          <span className="sr-only" role="status">{busy ? 'Saving instructor assignment.' : ''}</span>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={close}>Cancel</button>
          <button type="submit" className="admin-button user-primary" disabled={busy || loadingCandidates || Boolean(loadError)}>
            {busy ? 'Saving…' : isChange ? 'Save assignment' : 'Assign instructor'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
