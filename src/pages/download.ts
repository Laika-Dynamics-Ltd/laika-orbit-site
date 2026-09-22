// /download — the current release, counted and then redirected to GitHub. See src/lib/download-hit.mjs.
// A 302, never a 301: the target changes with every release, and a cached permanent redirect
// would both skip the count and keep serving an old version.
import type { APIRoute } from 'astro'
import { downloadHit, downloadTarget, sendHit } from '../lib/download-hit.mjs'

export const prerender = false

export const GET: APIRoute = async ({ request, redirect }) => {
  const target = downloadTarget()
  // no release on offer: the address people guess still lands on the home page
  if (!target) return redirect('/', 302)
  await sendHit(import.meta.env.PUBLIC_PULSE_ENDPOINT, downloadHit(target.file, request.headers), request.headers.get('user-agent') ?? '')
  return redirect(target.url, 302)
}
