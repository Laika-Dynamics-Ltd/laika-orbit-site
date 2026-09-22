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
 *
 * Downloads are not counted here. They used to be — a click on [data-download] was sent as a hit
 * at "/download" — but a click is not a download, and it was lost whenever the navigation beat
 * the beacon or the browser was blocking scripts. The button now goes through /download/<file>,
 * which counts on the server (src/lib/download-hit.mjs) at the path of the file it hands out.
 *
 * window.__orbitHit(path) is left behind for anything else that ever needs counting. Under Global
 * Privacy Control or Do Not Track it is never defined, so a call is exactly as silent as a page
 * load. Callers must check for it.
 */
export function beaconScript(endpoint) {
  if (!endpoint) return ''
  const url = `${String(endpoint).replace(/\/+$/, '')}/v1/hit`
  return `(()=>{try{var n=navigator;if(n.globalPrivacyControl||n.doNotTrack==='1'||window.doNotTrack==='1')return;var u=${JSON.stringify(url)};var s=function(p){try{var r='';try{r=document.referrer?new URL(document.referrer).hostname:''}catch(e){}var b=JSON.stringify({path:p,ref:r});n.sendBeacon?n.sendBeacon(u,new Blob([b],{type:'text/plain'})):fetch(u,{method:'POST',body:b,keepalive:true,mode:'no-cors'})}catch(e){}};window.__orbitHit=s;s(location.pathname)}catch(e){}})()`
}
