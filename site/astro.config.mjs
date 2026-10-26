import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://aws-dev-kb.example.com',
  build: { format: 'directory' },
  integrations: [mdx(), react()],
  markdown: {
    // Mermaid fences are rendered client-side (see components/Mermaid.astro), not highlighted.
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid', 'math'] },
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  vite: {
    plugins: [tailwindcss()],
    // Mermaid's chunks are large but lazy-loaded, and only on pages that contain a diagram.
    build: { chunkSizeWarningLimit: 3000 },
    // Content and samples live at the repo root, outside the Astro project.
    server: { fs: { allow: ['..'] } },
  },
});
