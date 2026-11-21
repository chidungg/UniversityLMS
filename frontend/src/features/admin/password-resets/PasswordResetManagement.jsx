import { useEffect, useRef, useState } from 'react'
import AdminShell from '../../../components/layout/AdminShell'
import Dialog from '../../../components/ui/Dialog'
import { PasswordField } from '../../auth/AuthenticationPage'
import { request } from '../../../services/http'
import { useAuth } from '../../../app/AuthContext'
import '../../auth/session.css'
import '../admin.css'
const statuses = { Pending: 'Chờ xử lý', Completed: 'Đã đặt lại', Rejected: 'Đã từ chối' }
const roles = { Administrator: 'Quản trị viên', Instructor: 'Giảng viên', Student: 'Sinh viên' }
const date = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—'

function ResolveDialog({ item, account, onClose, onSaved }) {
  const { user } = useAuth()
  const [values, setValues] = useState({ action: 'complete', verified: false, password: '', confirmPassword: '', resolutionNote: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)
  const lock = useRef(false)
  const eligible = account?.status === 'Active' && account.id !== user._id
  const complete = values.action === 'complete'
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  function update(key, value) { setValues((previous) => ({ ...previous, [key]: value })); setError('') }
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    if (complete && (!values.verified || values.password.length < 8 || new TextEncoder().encode(values.password).length > 72 || values.password !== values.confirmPassword)) { setError('Xác minh danh tính và nhập mật khẩu khớp, ít nhất 8 ký tự, tối đa 72 byte UTF-8.'); return }
    if (!complete && !values.resolutionNote.trim()) { setError('Vui lòng nhập lý do từ chối.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      await request(`/admin/recovery-requests/${item.id}`, { method: 'PATCH', body: { ...values, ...(complete ? {} : { password: undefined, confirmPassword: undefined }) } })
      setValues((previous) => ({ ...previous, password: '', confirmPassword: '' }))
      onSaved(complete ? 'Đã đặt lại mật khẩu và thu hồi các phiên cũ. Cung cấp mật khẩu tạm qua kênh đã xác minh; người dùng phải đổi mật khẩu khi đăng nhập.' : 'Đã từ chối yêu cầu. Mật khẩu không thay đổi.')
    } catch (failure) { setError(`${failure.message}${failure.status === 0 ? ' Yêu cầu có thể đã được xử lý; tải lại danh sách trước khi thử lại.' : ''}`) }
    finally { lock.current = false; setBusy(false) }
  }
  return <Dialog onDismiss={() => { if (!busy) onClose() }} aria-labelledby="resolve-title"><div className="recovery-dialog">
    <h2 id="resolve-title">Yêu cầu đặt lại mật khẩu</h2><p><strong>{account?.name || 'Chưa tìm thấy tài khoản'}</strong><br />{item.email}{account && <><br />{roles[account.role]} · {account.status === 'Active' ? 'Đang hoạt động' : 'Bị vô hiệu hóa'}</>}</p>
    <p>Gửi lúc: {date(item.submittedAt)}<br />Ghi chú: {item.note || 'Không có'}</p>
    {item.status !== 'Pending' ? <><p>{statuses[item.status]} · {date(item.reviewedAt)}<br />Người xử lý: {item.reviewedBy || '—'}<br />Kết quả: {item.resolutionNote || 'Không có ghi chú'}</p><button type="button" onClick={onClose}>Đóng</button></> : <form className="session-form" onSubmit={submit} aria-busy={busy}>
      {error && <div className="session-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
      {!eligible && <p className="session-error">{account?.id === user._id ? 'Không tự xử lý yêu cầu reset của mình. Dùng chức năng đổi mật khẩu hoặc nhờ quản trị viên khác.' : 'Chỉ được đặt lại mật khẩu cho tài khoản đang hoạt động. Kiểm tra email và trạng thái tài khoản.'}</p>}
      <div className="session-field"><label htmlFor="reset-action">Kết quả xử lý</label><select id="reset-action" value={values.action} onChange={(event) => update('action', event.target.value)} disabled={busy}><option value="complete">Đặt lại mật khẩu</option><option value="reject">Từ chối yêu cầu</option></select></div>
      {complete && <><label className="session-checkbox"><input type="checkbox" checked={values.verified} onChange={(event) => update('verified', event.target.checked)} disabled={busy || !eligible} required />Tôi đã xác minh danh tính chủ tài khoản qua quy trình của trường.</label><PasswordField id="temporary-password" label="Mật khẩu tạm" value={values.password} onChange={(value) => update('password', value)} disabled={busy || !eligible} /><PasswordField id="confirm-temporary-password" label="Xác nhận mật khẩu tạm" value={values.confirmPassword} onChange={(value) => update('confirmPassword', value)} disabled={busy || !eligible} /><p>Mật khẩu tối thiểu 8 ký tự, tối đa 72 byte UTF-8. Hệ thống không gửi email; chỉ cung cấp mật khẩu qua kênh đã xác minh.</p></>}
      <div className="session-field"><label htmlFor="resolution-note">{complete ? 'Ghi chú xử lý (không bắt buộc)' : 'Lý do từ chối'}</label><textarea id="resolution-note" rows={3} required={!complete} maxLength={300} value={values.resolutionNote} onChange={(event) => update('resolutionNote', event.target.value)} disabled={busy} /><small>Không ghi mật khẩu vào ghi chú.</small></div>
      <div className="recovery-actions"><button type="button" onClick={onClose} disabled={busy}>Hủy</button><button type="submit" className="session-primary" disabled={busy || (complete && !eligible)}>{busy ? 'Đang xử lý…' : complete ? 'Xác nhận đặt lại' : 'Xác nhận từ chối'}</button></div>
    </form>}
  </div></Dialog>
}

export default function PasswordResetManagement() {
  const [data, setData] = useState({ requests: [], users: [], pagination: { total: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState({ q: '', status: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    document.title = 'Đặt lại mật khẩu | University LMS'
    const controller = new AbortController()
    setLoading(true); setError('')
    const params = new URLSearchParams({ ...filter, limit: 20 })
    request(`/admin/recovery-requests?${params}`, { signal: controller.signal }).then((result) => { setData(result); setLoading(false) }).catch((failure) => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false) } })
    return () => controller.abort()
  }, [filter, revision])
  const pages = Math.max(1, Math.ceil(data.pagination.total / 20))
  return <AdminShell path="/admin/password-resets"><div className="recovery-workspace">
    <div><h1>Đặt lại mật khẩu</h1><p>Xác minh danh tính và xử lý yêu cầu của sinh viên, giảng viên và quản trị viên.</p></div>
    {message && <p className="session-success" role="status">{message}</p>}
    <form className="recovery-filters" onSubmit={(event) => { event.preventDefault(); setFilter((previous) => ({ ...previous, q: query.trim(), page: 1 })) }}>
      <div className="session-field"><label htmlFor="reset-search">Tìm theo email</label><input id="reset-search" type="search" value={query} maxLength={254} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="session-field"><label htmlFor="reset-status">Trạng thái</label><select id="reset-status" value={filter.status} onChange={(event) => setFilter((previous) => ({ ...previous, status: event.target.value, page: 1 }))}><option value="">Tất cả</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <button type="submit">Tìm kiếm</button><button type="button" onClick={() => setRevision((value) => value + 1)}>Tải lại</button>
    </form>
    {error ? <p role="alert" className="session-error">{error}</p> : loading ? <p role="status">Đang tải yêu cầu…</p> : <>
      <div className="recovery-table"><table><caption className="sr-only">Yêu cầu khôi phục tài khoản</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Gửi lúc</th><th scope="col">Trạng thái</th><th scope="col">Hành động</th></tr></thead><tbody>{data.requests.map((item) => { const account = data.users.find((entry) => entry.email === item.email); return <tr key={item.id}><td>{account?.name || 'Chưa tìm thấy tài khoản'}<small>{item.email}</small><small>{account ? roles[account.role] : 'Cần xác minh email'}</small></td><td>{date(item.submittedAt)}</td><td>{statuses[item.status]}</td><td><button onClick={() => setSelected({ item, account })}>{item.status === 'Pending' ? 'Xử lý' : 'Chi tiết'}</button></td></tr> })}</tbody></table>{!data.requests.length && <p style={{ padding: 20 }}>Không có yêu cầu phù hợp.</p>}</div>
      <div className="recovery-actions"><button disabled={filter.page <= 1} onClick={() => setFilter((previous) => ({ ...previous, page: previous.page - 1 }))}>Trang trước</button><span>Trang {filter.page}/{pages} · {data.pagination.total} yêu cầu</span><button disabled={filter.page >= pages} onClick={() => setFilter((previous) => ({ ...previous, page: previous.page + 1 }))}>Trang sau</button></div>
    </>}
    {selected && <ResolveDialog {...selected} onClose={() => setSelected(null)} onSaved={(feedback) => { setSelected(null); setMessage(feedback); setRevision((value) => value + 1) }} />}
  </div></AdminShell>
}
