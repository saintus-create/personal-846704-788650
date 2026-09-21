import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sidebar from './src/sidebar-data.json';

export default defineConfig({
  site: 'https://saintus-create.github.io',
  base: '/personal-846704-788650',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'CA Leg Info',
      description: 'California Codes — full statutory text, search, and AI research',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      sidebar,
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/saintus-create/personal-846704-788650' },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
