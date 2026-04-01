
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // សំខាន់បំផុតសម្រាប់ GitHub Pages
  server: {
    port: 3000,
  },
});
