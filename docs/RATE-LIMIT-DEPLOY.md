# Switching on the shared rate limiter

laikaorbit.com's public endpoints — checkout, billing portal, licence fetch, licence verify,
waitlist — are limited per IP. Until this is switched on, the count lives in a `Map` inside each
Vercel function instance, so the real ceiling is the limit times however many instances happen to be
warm. This makes them all count in one place: one row per (endpoint, caller) in the **pulse worker's**
D1, via `POST /v1/limit`. The worker was chosen over Vercel KV or Upstash because it is already ours:
no new dependency, no new bill.

Two things to know before you start, because they shape every check below:

- **It fails open.** If the worker is slow, down, or unconfigured, the site proceeds on its local
  count (`overLimitShared` in `src/lib/rate-limit.ts` returns `false` on any error). So a half-finished
  deploy never shows as an error a customer sees — it shows as *no shared protection at all*. The only
  honest proof it is working is a row in D1, which is why step 8 exists.
- **It spans two repos.** The worker and its schema are in the app repo
  (`laika-orbit/tools/pulse-ingest`); the environment variables are in this site's Vercel project.
  Each command below says which directory it runs in.

Cost: $0. D1 free tier is 100k row writes a day; one limited request is one row write.

## Where things stand

Run these three first — they are read-only, and they tell you which steps you still need. What they
printed on 2026-09-24:

```bash
curl -s https://laika-pulse.laikadynamics.workers.dev/v1/health
# {"ok":true}                 the worker is live

curl -s -X POST -d '{}' https://laika-pulse.laikadynamics.workers.dev/v1/limit
# {"error":"not found"}       the deployed worker predates the /v1/limit route → steps 1-5 needed
# {"error":"unauthorized"}    the route is deployed → skip to step 6

curl -s https://laikaorbit.com/ | grep -o 'https://[a-z0-9.-]*workers\.dev' | head -1
# https://laika-pulse.laikadynamics.workers.dev
#                             PUBLIC_PULSE_ENDPOINT is already set in Vercel (the beacon uses it)
```

## The worker half, in one block

Three commands do the worker side: the shared secret, the table, the deploy. Each is followed by the
thing that tells you it worked, so nothing here has to be taken on trust. Paste it a step at a time.
The sections after this one are the same three commands with the reasoning, plus the site half.

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit/tools/pulse-ingest
npx wrangler whoami              # ✔ the Laika Dynamics account — the one that owns laika-pulse

# ── 1. the shared secret ──────────────────────────────────────────────────────────────────────
# One random string, generated straight into your Keychain, never into a file. The worker knows it
# as PULSE_LIMIT_TOKEN; the site's Vercel project holds the same string as RATE_LIMIT_TOKEN, which
# is where the site side reads it from (step 6). Skip the first command if it is already there.
security add-generic-password -U -s 'laika-orbit secret' -a orbit-pulse-limit-token \
  -l 'laika-orbit secret: orbit-pulse-limit-token' \
  -w "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"

security find-generic-password -s 'laika-orbit secret' -a orbit-pulse-limit-token -w \
  | tr -d '\n' | npx wrangler secret put PULSE_LIMIT_TOKEN
#   ✨ Success! Uploaded secret PULSE_LIMIT_TOKEN
npx wrangler secret list         # ✔ PULSE_LIMIT_TOKEN listed beside PULSE_READ_TOKEN (names only)

# ── 2. the table the counter lives in ─────────────────────────────────────────────────────────
# schema.sql is every table in the database, all CREATE TABLE IF NOT EXISTS, so this adds
# rate_limit and leaves the live page-view and install data untouched.
npx wrangler d1 execute laika-pulse --remote --file=schema.sql --yes
npx wrangler d1 execute laika-pulse --remote --yes --command "SELECT count(*) AS n FROM rate_limit"
#   ✔ n = 0 — a "no such table: rate_limit" here means the schema did not apply

# ── 3. the deploy ─────────────────────────────────────────────────────────────────────────────
# wrangler deploy, not deploy.sh: that script is the first-time installer and would try to create
# the database and rotate the read token.
npx wrangler deploy
#   ✔ prints https://laika-pulse.laikadynamics.workers.dev
curl -s -X POST -d '{}' https://laika-pulse.laikadynamics.workers.dev/v1/limit
#   ✔ {"error":"unauthorized"} — it answered {"error":"not found"} before the deploy, so this one
#     line is the proof the new code is actually the code now running
```

Then the counting itself, end of step 5: four calls with the token, watching `n` climb to `over: true`.
And step 8 for the check that matters — whether the *site* is asking.

## 1. Let both code changes land on main first

Nothing here deploys code by hand. Two branches carry this work, both marked `Ready: yes`, and the
merge train lands them:

- app repo — `The pulse worker keeps the site's burst counts…` (adds `/v1/limit`, the `rate_limit`
  table, and the cron prune)
- this repo — `The public endpoints ask the shared counter, and carry on if it cannot answer`

Check the worker half has landed before you deploy anything, or step 5 will cheerfully redeploy a
worker without the route:

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit
git log --oneline -1 main
grep -c "v1/limit" tools/pulse-ingest/worker.js   # 1 or more, not 0
```

## 2. Make the shared secret, once

One random string is shared by the worker (as `PULSE_LIMIT_TOKEN`) and the site (as
`RATE_LIMIT_TOKEN`). Generate it into your Keychain rather than a file, the same way
`tools/pulse-ingest/deploy.sh` keeps the read token:

```bash
security add-generic-password -U -s 'laika-orbit secret' -a orbit-pulse-limit-token \
  -l 'laika-orbit secret: orbit-pulse-limit-token' -w "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

Prints nothing. Read it back when a later step needs it:

```bash
security find-generic-password -s 'laika-orbit secret' -a orbit-pulse-limit-token -w
```

Do the same for the salt (`RATE_LIMIT_SALT`, account `orbit-rate-limit-salt`). The salt must stay
**stable for ever**: it salts the SHA-256 of the caller's address, so changing it puts every caller
in a fresh bucket and every count restarts at one. It is a separate value from the token so that
rotating the token does not silently reset every window.

## 3. Create the `rate_limit` table on the live database

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit/tools/pulse-ingest
npx wrangler whoami                  # must be the Laika Dynamics account that owns laika-pulse
npx wrangler d1 execute laika-pulse --remote --file=schema.sql --yes
```

`schema.sql` is every table, all `CREATE TABLE IF NOT EXISTS`, so re-applying it to the live database
changes nothing that already exists — it only adds the missing one. Expect wrangler to print the
number of queries executed and rows written, with no error. Confirm:

```bash
npx wrangler d1 execute laika-pulse --remote --yes \
  --command "SELECT count(*) AS n FROM rate_limit"
# n = 0
```

A `no such table: rate_limit` here means the schema did not apply — most often because wrangler is
logged into the wrong account and created a *different* `laika-pulse`. Check the id it reports against
`database_id` in `wrangler.toml`.

## 4. Set the token on the worker

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit/tools/pulse-ingest
security find-generic-password -s 'laika-orbit secret' -a orbit-pulse-limit-token -w \
  | tr -d '\n' | npx wrangler secret put PULSE_LIMIT_TOKEN
# 🌀 Creating the secret for the Worker "laika-pulse"
# ✨ Success! Uploaded secret PULSE_LIMIT_TOKEN
npx wrangler secret list
# a list including PULSE_READ_TOKEN and PULSE_LIMIT_TOKEN (names only, never values)
```

The `tr -d '\n'` matters: a trailing newline in the secret makes every `Authorization` header
mismatch, and the symptom is a 401 with what looks like the right token.

## 5. Deploy the worker

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit/tools/pulse-ingest
npx wrangler deploy
# Uploaded laika-pulse … Deployed laika-pulse triggers …
#   https://laika-pulse.laikadynamics.workers.dev
#   schedule: 23 */6 * * *
```

Do **not** run `deploy.sh` for this. That script is the first-time installer: it would try to create
the database and rotate the read token. The worker is already deployed; this is an update.

Now the route answers. With no token, and with the token:

```bash
W=https://laika-pulse.laikadynamics.workers.dev
T=$(security find-generic-password -s 'laika-orbit secret' -a orbit-pulse-limit-token -w)
who=$(printf 'probe' | shasum -a 256 | cut -d' ' -f1)

curl -s -X POST "$W/v1/limit" -d '{}'
# {"error":"unauthorized"}

for i in 1 2 3 4; do
  curl -s -X POST "$W/v1/limit" -H "authorization: Bearer $T" -H 'content-type: application/json' \
    -d "{\"name\":\"probe\",\"who\":\"$who\",\"max\":3,\"windowMs\":600000}"; echo
done
# {"n":1,"over":false}
# {"n":2,"over":false}
# {"n":3,"over":false}
# {"n":4,"over":true}      the fourth call in the window is over a max of 3
```

That is the whole worker half proved: authentication, counting, and the threshold. Tidy the probe row
away (the cron would drop it a day after its window lapses anyway):

```bash
npx wrangler d1 execute laika-pulse --remote --yes \
  --command "DELETE FROM rate_limit WHERE bucket LIKE 'probe:%'"
```

## 6. Give the site the token and the salt

Three variables, in the Vercel project for **laika-orbit-site**, Production (and Preview, if you want
previews to share the counter — harmless, they use the same buckets):

| name | value |
|---|---|
| `PUBLIC_PULSE_ENDPOINT` | `https://laika-pulse.laikadynamics.workers.dev` — already set; the page-view beacon uses it |
| `RATE_LIMIT_TOKEN` | the same string as the worker's `PULSE_LIMIT_TOKEN`, from step 2 |
| `RATE_LIMIT_SALT` | the stable salt from step 2 |

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit-site
npx vercel env ls production                     # what is already there, names only
npx vercel env add RATE_LIMIT_TOKEN production   # paste the value when it asks
npx vercel env add RATE_LIMIT_SALT production
```

Or Vercel dashboard → the project → Settings → Environment Variables. Either way, paste with no
trailing newline or space.

## 7. Redeploy the site

A Vercel environment variable only reaches running functions on the next deployment. Until then the
site keeps counting per instance and says nothing about it.

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit-site
npx vercel --prod
```

Or dashboard → Deployments → the latest production one → ⋯ → Redeploy. If the site half from step 1
has just landed on main, its own Vercel build already covers this — no second redeploy needed, as
long as it built *after* the variables were added.

## 8. Prove the site is really asking the worker

Three harmless requests to the licence-verify endpoint. An invalid key is rejected by the signature
check before Stripe is ever called, so this costs nothing and touches no customer data — but it does
go through the limiter, whose `verify` bucket allows 120 in ten minutes:

```bash
for i in 1 2 3; do
  curl -s -X POST https://laikaorbit.com/api/license/verify \
    -H 'content-type: application/json' -d '{"key":"not-a-licence"}'; echo
done
# {"valid":false,"reason":"not a genuine licence key"}   ×3
```

Then look for the row they made:

```bash
cd ~/dev/'Laika Local Tools'/laika-orbit/tools/pulse-ingest
npx wrangler d1 execute laika-pulse --remote --yes \
  --command "SELECT bucket, n FROM rate_limit"
# bucket = verify:<64 hex>   n = 3
```

`n = 3` under a single `verify:` bucket is the proof: one row, counted three times, from a caller the
worker knows only as a hash. It is worth being precise about why this is the check and a 429 is not.

A shared limiter and one that has silently fallen back to the per-instance count are identical from
outside. Both answer 200. Both answer at the same speed. Neither logs anything: `overLimitShared`
returns `false` on a missing endpoint, a missing token, a non-200, and on its own 600ms timeout, and
`false` means *not over the limit*, so the request simply proceeds. There is no error to find, and you
cannot tell them apart by hammering the endpoint either — the local count still produces a 429 on its
own once one instance is hot enough, so a 429 proves nothing about the shared half.

The row is the only observable that differs. Three requests, one row, `n = 3`:

- **no rows at all** → the site is not reaching the worker: `RATE_LIMIT_TOKEN` or
  `PUBLIC_PULSE_ENDPOINT` missing in Vercel, or added without the redeploy in step 7
- **`n` short of 3, or rows appearing only sometimes** → the worker is answering slower than the
  600ms budget, so some calls time out and fall back. `npx wrangler tail` while you repeat the loop
- **more than one `verify:` bucket for the same caller** → `RATE_LIMIT_SALT` is not stable, and every
  count is restarting at one

Repeat the loop from a second network (phone hotspot) if you want the buckets-per-caller behaviour
confirmed as well: a different address must produce a second bucket, not add to the first.

## Two things that must stay true

If this is ever rewritten, moved to another store, or extended, these two are the ones to preserve.
Both are cheap to keep and quiet to break.

**The worker never sees an address.** The site hashes the caller's IP — SHA-256, salted with
`RATE_LIMIT_SALT`, a secret the site alone holds — and sends only the hex. The worker stores that
opaque string as `bucket` and could not reverse it if it wanted to. This is what keeps
laikaorbit.com's privacy page true when it says no IP address is kept, so the hashing has to stay on
the site's side of the wire. A future version that posts the address and hashes it in the worker
would pass every test in this document and quietly make that page a lie.

**The cron's two jobs share one promise.** In `worker.js`'s `scheduled`, the release sample and the
pruning of lapsed windows are awaited inside a single `ctx.waitUntil`. Two `waitUntil` calls is the
obvious way to write it and it is wrong: a caller that keeps only the last promise it is handed — the
repo's own tests do — stops waiting on the first, which is the release sample, the half that matters.
The pruning is the cheap half and must not displace it.

## The layers above this one

This limiter is the floor, not the defence. The two attacks worth naming have stronger, cheaper
answers that are configuration rather than code:

- **card testing** on the checkout route → Stripe Radar rules, in the Stripe dashboard
- **licence-key brute force** on `/api/license/verify` → Vercel firewall rules, in the project's
  Firewall tab

Both act before a request costs us anything, and neither needs a deploy to change. The shared counter
sits beneath them: it is what stops an ordinary flood from one address, and what makes the ceiling a
real number instead of a number times however many instances are warm.

## When it does not work

The site never errors on your behalf, so read the worker's answer, not the site's.

| What you see | Why | Fix |
|---|---|---|
| `{"error":"not found"}`, 404 | the deployed worker has no `/v1/limit` — the app-repo change has not landed or has not been deployed | step 1, then step 5 |
| `{"error":"unauthorized"}`, 401, with the right token | `PULSE_LIMIT_TOKEN` unset on the worker, or differs from what you sent (a trailing newline counts) | step 4 |
| `{"error":"server error"}`, 500 | the `rate_limit` table is missing: the upsert throws and the router turns it into a blank 500 on purpose | step 3 |
| `{"error":"send { name, who: sha256 hex, max, windowMs }"}`, 400 | body shape: `name` must be lowercase `[a-z][a-z0-9-]{0,39}`, `who` exactly 64 hex, `windowMs` between 1s and 24h | fix the probe body; the site always sends these correctly |
| `Couldn't find DB with name/id 'laika-pulse'` from wrangler | wrangler is logged into an account that does not own the database in `wrangler.toml` | `npx wrangler login`, then `npx wrangler whoami` |
| worker probes all pass, no D1 rows from step 8 | `RATE_LIMIT_TOKEN` or `PUBLIC_PULSE_ENDPOINT` missing in Vercel, or added without a redeploy | steps 6 and 7 |
| a caller's count keeps restarting at 1 | `RATE_LIMIT_SALT` changed, or was never set so it fell back to the token and rotating the token rotated every bucket | set the salt once, leave it |
| `pulse prune` errors in `npx wrangler tail` | the cron is pruning a table that does not exist; the release sampler still runs | step 3 |

## Turning it off again

It degrades by design, so there is no migration to undo. Either end will do it, and neither needs a
code change:

```bash
npx wrangler secret delete PULSE_LIMIT_TOKEN      # worker side: /v1/limit answers 401 to everyone
npx vercel env rm RATE_LIMIT_TOKEN production     # site side: it stops asking at all
```

Then redeploy the site. Both put the limits back to per-instance counting — weaker, but working. The
`rate_limit` table can stay; the cron empties it within a day and it holds nothing but hashes.
