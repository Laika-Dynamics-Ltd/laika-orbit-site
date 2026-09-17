// @ts-check
import starlight from '@astrojs/starlight'
import vercel from '@astrojs/vercel'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://laikaorbit.com',
  // pages stay static; the checkout, webhook and licence routes run as Vercel functions
  adapter: vercel(),
  // the dev toolbar sits over the page in every capture
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: 'Laika Orbit',
      description:
        'Docs for Laika Orbit, the local-first workspace for Claude Code, and 1brain, its zero-model retrieval engine.',
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
            { label: 'Browser', slug: 'docs/browser' },
            { label: 'Widgets', slug: 'docs/widgets' },
          ],
        },
        {
          label: '1brain',
          items: [
            { label: 'Overview', slug: 'docs/1brain' },
            { label: 'Use with Claude Code (MCP)', slug: 'docs/1brain/mcp' },
            { label: 'CLI', slug: 'docs/1brain/cli' },
            { label: 'Router files', slug: 'docs/1brain/routers' },
            { label: 'How recall works', slug: 'docs/1brain/how-recall-works' },
            { label: 'Index configuration', slug: 'docs/1brain/configuration' },
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
