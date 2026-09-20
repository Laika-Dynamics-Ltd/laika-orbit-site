// @ts-check
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'
import vercel from '@astrojs/vercel'
import { defineConfig } from 'astro/config'
import { beaconScript } from './src/lib/beacon.mjs'

// the docs pages count views the same way as the rest of the site (see src/lib/beacon.mjs)
const beacon = beaconScript(process.env.PUBLIC_PULSE_ENDPOINT)

/**
 * Vercel Web Analytics on every page, docs included, from one place. The beacon has to be wired
 * twice — once here for Starlight, once in Site.astro — because it is an inline string; this is a
 * module, so a single injected import covers all 25 pages and there is no second place to forget.
 * What it sends, and what it refuses to send, is src/lib/analytics.mjs.
 */
const vercelAnalytics = {
  name: 'laika:vercel-analytics',
  hooks: {
    'astro:config:setup': ({ injectScript }) => injectScript('page', "import '/src/lib/analytics-client.mjs'"),
  },
}

export default defineConfig({
  site: 'https://laikaorbit.com',
  // addresses people type or link to by guess; each used to be a 404
  redirects: {
    '/download': '/', // the hero holds the button, the requirements and the checksum
    '/changelog': 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases',
    '/support': '/docs/',
    '/contact': 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/issues',
  },
  // pages stay static; the checkout, webhook and licence routes run as Vercel functions
  adapter: vercel(),
  // the dev toolbar sits over the page in every capture
  devToolbar: { enabled: false },
  integrations: [
    vercelAnalytics,
    // pages marked noindex stay out of the sitemap: the Pro account pages
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/pro/') }),
    starlight({
      title: 'Laika Orbit',
      description:
        'Docs for Laika Orbit, mission control for your Claude Code agents, and Laika Orbit recall, its zero-model retrieval engine.',
      // docs pages share the site's card when linked, and count views the same way as the rest of
      // the site. One head, deliberately: two `head` keys here means the second silently wins.
      head: [
        ...(beacon ? [{ tag: 'script', content: beacon }] : []),
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://laikaorbit.com/og.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://laikaorbit.com/og.png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit' },
      ],
      editLink: { baseUrl: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit-site/edit/main/' },
      customCss: ['@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono', './src/styles/theme.css'],
      components: {
        ThemeProvider: './src/components/docs/ThemeProvider.astro',
        ThemeSelect: './src/components/docs/ThemeSelect.astro',
        SiteTitle: './src/components/docs/SiteTitle.astro',
      },
      // one dark code theme, framed like the site's panels
      expressiveCode: {
        themes: ['github-dark-default'],
        useStarlightUiThemeColors: true,
        styleOverrides: {
          borderRadius: '12px',
          borderColor: 'rgba(255, 255, 255, 0.13)',
          codeFontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
          codeBackground: '#0d0e11',
          frames: { editorTabBarBackground: '#111216', terminalTitlebarBackground: '#111216', terminalTitlebarBorderBottomColor: 'rgba(255, 255, 255, 0.08)', frameBoxShadowCssValue: 'none' },
        },
      },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Install and first run', slug: 'docs/getting-started' },
          ],
        },
        {
          label: 'Laika Orbit',
          items: [
            { label: 'Claude panel', slug: 'docs/claude-panel' },
            { label: 'Knowledge map', slug: 'docs/knowledge-map' },
            { label: 'Away mode', slug: 'docs/away-mode' },
            { label: 'Browser', slug: 'docs/browser' },
            { label: 'Other machines', slug: 'docs/other-machines' },
            { label: 'Widgets', slug: 'docs/widgets' },
          ],
        },
        {
          label: 'Laika Orbit recall',
          items: [
            { label: 'Overview', slug: 'docs/recall' },
            { label: 'Use with Claude Code (MCP)', slug: 'docs/recall/mcp' },
            { label: 'CLI', slug: 'docs/recall/cli' },
            { label: 'Router files', slug: 'docs/recall/routers' },
            { label: 'How recall works', slug: 'docs/recall/how-recall-works' },
            { label: 'Index configuration', slug: 'docs/recall/configuration' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Keyboard shortcuts', slug: 'docs/reference/keyboard-shortcuts' },
            { label: 'Settings and files', slug: 'docs/reference/settings' },
            { label: 'Privacy and security', slug: 'docs/reference/security' },
          ],
        },
      ],
    }),
  ],
})
