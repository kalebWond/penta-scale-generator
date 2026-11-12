import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import ingest from './tools/ingest-server.js'

export default defineConfig(({ mode }) => ({
    // ingest: the dev server's back end ("Add songs", chord corrections, share links). REVIEW_SECRET
    // (in .env.local, and the same on Netlify) signs musicians' share links.
    plugins: [react(), ingest({ reviewSecret: loadEnv(mode, process.cwd(), '').REVIEW_SECRET })],
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
}))
