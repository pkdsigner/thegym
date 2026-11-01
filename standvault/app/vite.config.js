import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tailwind runs through its Vite plugin. An empty PostCSS config stops Vite picking up the
  // PulseFit project's postcss.config.js in the parent folder.
  css: { postcss: {} },
  server: {
    port: 5173,
    // The app shares config/naming.js and config/taxonomy.json with the scanner, one folder up.
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:5174' },
  },
});
