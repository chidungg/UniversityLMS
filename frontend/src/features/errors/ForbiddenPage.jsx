import ErrorPage from './ErrorPage'

export default function ForbiddenPage() {
  return <ErrorPage
    code="403"
    label="Access denied"
    title="You don’t have permission to view this page"
    description="Your account does not have access to this content. If you think this is a mistake, contact your university administrator."
  />
}
