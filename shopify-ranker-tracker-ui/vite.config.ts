import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '../',
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/x-data-grid',
      '@emotion/react',
      '@emotion/styled',
      'react-router-dom',
    ],
  },
  build: {
    // Disable source maps in production for smaller files
    sourcemap: false,
    // Increase chunk size warning limit (MUI is inherently large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui/x-data-grid')) {
              return 'vendor-datagrid';
            }
            if (id.includes('@mui/icons-material')) {
              return 'vendor-mui-icons';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'vendor-mui';
            }
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('motion') || id.includes('framer')) {
              return 'vendor-motion';
            }
            // Everything else in node_modules goes to vendor
            return 'vendor-misc';
          }
        },
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,

    allowedHosts: [
      'analytics.nexfal.com',
    ],

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 5173,

    allowedHosts: [
      'analytics.nexfal.com',
    ],

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
