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
]

/** Pro today, exactly. Nothing else is claimed for it. */
export const PRO_FEATURES = [
  'Everything in Free',
  'Signed and notarised Mac app',
  'Automatic updates',
  'Email support, answered in 2 working days',
  'Price locked for as long as you stay subscribed',
]

/** The one thing Pro does not have yet, said plainly under the plans so nobody buys on the strength of it. */
export const SYNC_NOTE = 'Sync is not built yet — aiming for the first half of 2027, at no extra cost for founding members.'

/** The founding terms as one compact row. The longer answers live in the questions below. */
export const TERMS = ['Prices in US dollars, tax added at checkout', '30 days to change your mind', 'Cancel any time; the free app carries on']
