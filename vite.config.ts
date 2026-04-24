import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Change 'tileword' to match your GitHub repo name exactly.
// If your repo is named 'tileword', the deployed URL will be:
//   https://yourusername.github.io/tileword/
// If your repo is at the root (yourusername.github.io), set base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/tileword/',
  build: {
    outDir: 'dist',
    // Inline everything into a single HTML file so it works on tiiny.host too
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
