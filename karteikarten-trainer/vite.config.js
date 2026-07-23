import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // node_modules was created by another user in OneDrive and is read-only here.
  // Keep generated Vite files in the user's writable system-temp directory.
  cacheDir: join(tmpdir(), 'karteikarten-trainer-vite-cache'),
  // The existing dist folder was also created by another user and cannot be
  // cleaned by Vite. Write fresh production builds to this writable folder.
  build: { outDir: 'build' },
})
