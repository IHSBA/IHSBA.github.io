import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Repo is IHSBA/IHSBA.github.io, an org root Pages site served at
// https://ihsba.github.io/ -- base path is "/", not a subpath.
export default defineConfig({
  plugins: [react()],
  base: '/',
});
