import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      // 'autoUpdate' = when you publish a new version, installed apps refresh
      // to the latest automatically the next time they open online.
      registerType: 'autoUpdate',
      // These static files (icons, favicon) are copied into the build and
      // made available offline.
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png'],
      // The Web App Manifest: this is what makes it installable as a PWA.
      manifest: {
        name: 'SimplyTools',
        short_name: 'SimplyTools',
        description: 'Free, on-device tools for 3D & VFX artists. Starting with SimplyHDRI.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // 'maskable' lets Android crop the icon into its preferred shape.
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Workbox controls offline caching of the built app shell.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      },
    }),
  ],
});
