// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://laikaorbit.com',
  integrations: [
    starlight({
      title: 'Laika Orbit',
      description:
        'Docs for Laika Orbit, the local-first workspace for Claude Code, and 1brain, its zero-model retrieval engine.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit' },
      ],
      editLink: { baseUrl: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit-site/edit/main/' },
      customCss: ['./src/styles/theme.css'],
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
