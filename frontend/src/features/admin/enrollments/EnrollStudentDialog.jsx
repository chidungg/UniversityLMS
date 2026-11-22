import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import {
  enrollStudent,
  enrollmentErrorMessage,
  listEnrollmentCandidates,
  validateEnrollmentSelection,
} from './enrollmentPreview'

const MAX_VISIBLE_OPTIONS = 25

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function EnrollStudentDialog({ selectedItem, authenticated = false, preview = false, onClose, onSaved }) {
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
      listEnrollmentCandidates(selectedItem.id, 'student', search, {
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
      if (candidates.some((entry) => entry.alreadyEnrolled)) {
        return `This student is already enrolled in ${selectedItem.code}.`
      }
      return `Invalid enrollment. Only active student accounts can be enrolled in a ${unitSingular}.`
    }
    return 'Select an active student to enroll.'
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || loadingCandidates) return
    setMessage('')
    if (!effectiveSelectedId) {
      showValidation(resolveMissingSelectionError())
      return
    }
    const validation = validateEnrollmentSelection(selectedItem, selectedCandidate, preview)
    if (validation) {
      showValidation(validation)
      return
    }
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await enrollStudent(selectedItem.id, effectiveSelectedId, {
        signal: controller.signal,
        authenticated,
      })
      const suffix = result.preview ? ' in this preview.' : '.'
      onSaved(result, `${result.student.name} enrolled in ${result.selectedItem.code}${suffix}`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(enrollmentErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog initialFocusRef={searchRef} onDismiss={close} aria-labelledby="enroll-student-title" aria-describedby="enroll-student-description">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">ENROLLMENT & ASSIGNMENT</p>
          <h2 id="enroll-student-title">Enroll student</h2>
        </div>
        <button type="button" className="dialog-close" aria-label="Close enroll student dialog" onClick={close}>
          <Icon name="close" />
        </button>
      </header>
      <form noValidate onSubmit={submit} aria-busy={busy || loadingCandidates}>
        <div className="dialog-body user-form">
          <div className="user-confirm-identity">
            <strong>{selectedItem.code}</strong>
            <span>{selectedItem.name}</span>
          </div>
          <p id="enroll-student-description">
            Find an active student account to enroll in this {unitSingular}. Each student can only be enrolled once per {unitSingular}.
          </p>
          {fieldError && (
            <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert">
              <strong>Please review your selection:</strong>
              <ul>
                <li>
                  <a href="#enroll-student-search" onClick={(event) => { event.preventDefault(); searchRef.current?.focus() }}>
                    {fieldError}
                  </a>
                </li>
              </ul>
            </div>
          )}
          <div className="user-field">
            <label htmlFor="enroll-student-search">Find user</label>
            <div className="user-search-control">
              <Icon name="search" size={18} />
              <input
                ref={searchRef}
                id="enroll-student-search"
                type="search"
                autoComplete="off"
                value={search}
                disabled={busy}
                placeholder="Search by student name or email…"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? 'enroll-student-error' : 'enroll-student-help'}
                onChange={(event) => { setSearch(event.target.value); setFieldError(''); setMessage('') }}
              />
            </div>
            <p id="enroll-student-help" className="user-field-help">
              Search by full name or email. Already-enrolled or ineligible accounts are labeled below.
            </p>
            {fieldError && <p id="enroll-student-error" className="user-field-error">{fieldError}</p>}
          </div>

          <fieldset className="enroll-picker-fieldset" disabled={busy}>
            <legend className="sr-only">Matching accounts for student enrollment</legend>
            <div className="enroll-picker-meta" role="status" aria-atomic="true">
              <span>
                {loadingCandidates
                  ? 'Searching available students…'
                  : candidates.length
                    ? `${eligibleCount} eligible ${eligibleCount === 1 ? 'student' : 'students'} available`
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
                <strong>Unable to load student list</strong>
                <p>{loadError}</p>
              </div>
            ) : loadingCandidates ? (
              <div className="enroll-picker-loading" role="status">
                <Icon name="refresh" size={18} className="admin-spinning" />
                <span>Loading students…</span>
              </div>
            ) : visibleCandidates.length ? (
              <>
                <ul className="enroll-picker-list">
                  {visibleCandidates.map(({ user, alreadyEnrolled, isTargetRole, eligible }) => (
                    <li key={user.id}>
                      {eligible ? (
                        <label className={`enroll-option ${effectiveSelectedId === user.id ? 'is-selected' : ''}`}>
                          <input
                            type="radio"
                            name="enroll-student-id"
                            value={user.id}
                            checked={effectiveSelectedId === user.id}
                            onChange={() => { setSelectedId(user.id); setFieldError(''); setMessage('') }}
                          />
                          <span className="user-initials" aria-hidden="true">{initials(user.name)}</span>
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
                              <span className={`enroll-tag ${alreadyEnrolled ? 'is-enrolled' : ''}`}>
                                {alreadyEnrolled ? 'Already enrolled' : !isTargetRole ? user.role : 'Inactive'}
                              </span>
                            </div>
                            <span className="enroll-option-email">{user.email}</span>
                            <span className={`enroll-option-reason ${!alreadyEnrolled ? 'is-warning' : ''}`}>
                              {alreadyEnrolled
                                ? `This student is already enrolled in ${selectedItem.code}.`
                                : !isTargetRole
                                  ? 'Invalid enrollment — only Student accounts can be enrolled.'
                                  : 'Inactive account — activate this student in User management first.'}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {candidates.length > MAX_VISIBLE_OPTIONS && (
                  <p className="enroll-picker-overflow">
                    Showing the first {MAX_VISIBLE_OPTIONS} of {candidates.length} matching accounts. Refine your search to find a specific student.
                  </p>
                )}
              </>
            ) : (
              <div className="enroll-picker-empty">
                <Icon name="search" size={24} />
                <strong>No user found</strong>
                <p>
                  {trimmed
                    ? `No account matches “${search.trim()}”. Check the name or email, or add the student in User management.`
                    : 'No student accounts are available in this workspace yet.'}
                </p>
              </div>
            )}
          </fieldset>

          <div className="user-info">
            <Icon name="enroll" size={20} />
            <p>
              {preview
                ? 'Changes are saved in this browser tab only. No live student enrollment is modified.'
                : 'Enrolling a student grants access to this course’s materials, assignments and quizzes immediately.'}
            </p>
          </div>
          {message && <p className="user-error-summary" role="alert">{message}</p>}
          <span className="sr-only" role="status">{busy ? 'Enrolling student.' : ''}</span>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={close}>Cancel</button>
          <button type="submit" className="admin-button user-primary" disabled={busy || loadingCandidates || Boolean(loadError)}>
            {busy ? 'Enrolling…' : 'Enroll student'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
