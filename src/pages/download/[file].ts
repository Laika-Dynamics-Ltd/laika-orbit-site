// /download/<file> — one named release asset, counted and then redirected to GitHub. Only a file
// the current release publishes is known; anything else is a 404, not a guess.
import type { APIRoute } from 'astro'
import { downloadHit, downloadTarget, sendHit } from '../../lib/download-hit.mjs'

export const prerender = false

export const GET: APIRoute = async ({ params, request, redirect }) => {
  const target = downloadTarget(params.file)
  if (!target) return new Response('Not found', { status: 404 })
  await sendHit(import.meta.env.PUBLIC_PULSE_ENDPOINT, downloadHit(target.file, request.headers), request.headers.get('user-agent') ?? '')
  return redirect(target.url, 302)
}
