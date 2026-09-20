/** What the pricing page shows. Amounts are display copy; the charged amount is the Stripe price. */
export const PRO = {
  monthly: { amount: 15, label: '$15', per: 'per month' },
  yearly: { amount: 150, label: '$150', per: 'per year', saving: '2 months free' },
  currency: 'USD',
}

/** Free is the whole app. Nothing in it is held back for Pro. */
export const FREE_FEATURES = [
  'The full Laika Orbit app',
  'Claude Code chats side by side, grid or task track',
  'A browser with a profile per account',
  'Inbox, calendar and widgets',
  'Laika Orbit recall: knowledge map, CLI, MCP server',
  'Signed and notarised by Apple: the Mac download opens without a warning',
]

/** Pro's headline: not built yet, so it is always shown marked as coming. */
export const ANYWHERE = {
  title: 'Orbit Anywhere',
  tag: 'Coming',
  line: 'Your fleet in your pocket.',
  points: [
    'The iPhone app: see every chat and what it needs',
    'Approve or answer from anywhere, with push alerts',
    'The morning briefing on your phone',
    'Sync across your Macs',
  ],
}

/** Pro today, exactly. Nothing else is claimed for it. */
export const PRO_FEATURES = [
  'Everything in Free',
  'Email support, answered within 2 working days',
  'Founding price, locked for as long as you stay subscribed',
]

/** The founding-price lock, and what everyone else pays once Anywhere ships. */
export const FOUNDING_NOTE = 'Founding members keep US$15 a month or US$150 a year for as long as they stay subscribed. The standard price becomes US$20 a month once Orbit Anywhere ships.'

/** Never in the flat price. */
export const ADDONS_NOTE = 'Cloud GPU and real-device testing: metered add-ons, coming later.'

/** What Pro does not have yet, said plainly under the plans so nobody buys on the strength of it. */
export const SYNC_NOTE = 'Orbit Anywhere is not built yet. Sync, part of it, is aiming for the first half of 2027. Both come at no extra cost for founding members.'
/** Said plainly, from the founding-membership story: join for what exists today. */
export const SYNC_HONEST = "We'd rather you joined for what's here today. If Anywhere is the reason you'd pay, the free app will do the job until it ships."

/** The founding terms as one compact row. The longer answers live in the questions below. */
export const TERMS = ['Prices in US dollars, tax added at checkout', '30 days to change your mind', 'Cancel any time; the free app carries on']
