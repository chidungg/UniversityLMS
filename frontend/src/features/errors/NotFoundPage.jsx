import ErrorPage from './ErrorPage'

export default function NotFoundPage() {
  return <ErrorPage
    code="404"
    label="Page not found"
    title="We can’t find this page"
    description="The address may have changed, or this page is no longer available. Return to sign in to continue."
  />
}
