import type { NextConfig } from 'next'

/**
 * Where the Express API actually lives. Only ever read here, at build time —
 * the browser is never told this address.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL

if (!apiUrl && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. A production build needs it as the target ' +
      'for the /api/v1 proxy. Set it to the API origin plus /api/v1, e.g. ' +
      'https://deliverx-api.example.com/api/v1',
  )
}

/** Accepts the value with or without the /api/v1 suffix; the proxy adds it. */
const apiOrigin = (apiUrl ?? 'http://localhost:4000').replace(/\/api\/v1\/?$/, '')

const config: NextConfig = {
  reactStrictMode: true,

  /**
   * The API is served from this app's own origin, and the browser never talks
   * to the API's hostname directly.
   *
   * The two deployments are separate sites — and because vercel.app is a public
   * suffix, `app.vercel.app` and `api.vercel.app` are cross-site, not sibling
   * subdomains. That made the session cookie a third-party cookie: Safari
   * blocks those outright, Chrome restricts them, and any private window or
   * "block third-party cookies" setting drops them. The result was an app that
   * worked on the browser it was set up in and showed blank screens everywhere
   * else, because each request arrived unauthenticated.
   *
   * Proxying through this origin makes the cookie first-party, which no browser
   * setting interferes with. It also means CORS stops being load-bearing: the
   * request is same-origin, so there is no preflight and no allowlist to keep
   * in step with the frontend's URL — which is what blocked preview
   * deployments from reaching the API at all.
   */
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }]
  },
}

export default config
