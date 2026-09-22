import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
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
