/**
 * The page-view beacon: one fire-and-forget POST per page load to the pulse worker's /v1/hit,
 * which adds one to a daily count of (path, referrer host, country). What the privacy page says,
 * and nothing more: aggregate, cookie-free, no profiles.
 *
 * It sends the path (no query, no fragment) and the referring host (not the full URL). No cookie,
 * no storage, no id. It does nothing when the visitor's browser asks not to be tracked (Global
 * Privacy Control or Do Not Track), and nothing at all unless PUBLIC_PULSE_ENDPOINT is set at
 * build, so a build without the worker ships no beacon.
 *
 * `text/plain` keeps the request "simple", so there is no CORS preflight.
 */
export function beaconScript(endpoint) {
  if (!endpoint) return ''
  const url = `${String(endpoint).replace(/\/+$/, '')}/v1/hit`
  return `(()=>{try{var n=navigator;if(n.globalPrivacyControl||n.doNotTrack==='1'||window.doNotTrack==='1')return;var r='';try{r=document.referrer?new URL(document.referrer).hostname:''}catch(e){}var b=JSON.stringify({path:location.pathname,ref:r});n.sendBeacon?n.sendBeacon(${JSON.stringify(url)},new Blob([b],{type:'text/plain'})):fetch(${JSON.stringify(url)},{method:'POST',body:b,keepalive:true,mode:'no-cors'})}catch(e){}})()`
}
