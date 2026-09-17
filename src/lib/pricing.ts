/** What the pricing page shows. Amounts are display copy; the charged amount is the Stripe price. */
export const PRO = {
  monthly: { amount: 15, label: '$15', per: 'per month' },
  yearly: { amount: 150, label: '$150', per: 'per year', saving: '2 months free' },
  currency: 'USD',
}

export const FREE_FEATURES = [
  'The full app, built from source (MIT)',
  'Claude Code chats side by side, grid and task track',
  'Browser with a profile per account',
  'Inbox, calendar and widgets',
  '1brain knowledge map, CLI and MCP server',
]

export const PRO_FEATURES = [
  'Everything in Free',
  'Signed, notarised Mac app with automatic updates',
  'Settings, workspaces and pins synced across your Macs',
  'Managed build runners for heavy jobs',
  'Priority email support',
]
