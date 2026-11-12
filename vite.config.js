import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ingest from './tools/ingest-server.js'

export default defineConfig({
    plugins: [react(), ingest()],     // ingest: the "Add songs" back end, dev server only
    server: {
        port: 3000,
        host: true,          // also serves on the LAN IP, for testing on a real phone
    },
    build: {
        outDir: 'build',     // keeps /build in .gitignore valid
    },
    test: {
        globals: true,       // describe/test/expect/vi global, as they were under Jest
        environment: 'jsdom', // engine.test.js assigns window.AudioContext
    },
})
