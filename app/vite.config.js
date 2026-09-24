import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // the corpus lives in the repo-root public/ dir; serve it in dev and copy it into dist
  publicDir: path.resolve(__dirname, '../public'),
  server: { host: '0.0.0.0', allowedHosts: true },
  build: { outDir: 'dist' },
});
