import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — DeliverX' }

export default function LoginPage() {
  /**
   * Suspense boundary because the form reads ?next= from the URL to send you
   * back where you were headed. Without it the static prerender of this page
   * fails, which dev mode does not surface but the build does.
   */
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
