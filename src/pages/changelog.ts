// An address people type or link to by guess; it used to be a 404. An endpoint rather than a config
// redirect, because the adapter gives a config redirect an exact-match rule and /changelog/ stayed a 404.
import type { APIRoute } from 'astro'

export const prerender = false
export const GET: APIRoute = ({ redirect }) => redirect('https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases', 301)
