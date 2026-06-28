import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const githubPagesBase = repoName?.endsWith('.github.io') ? '/' : repoName ? `/${repoName}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? githubPagesBase,
  plugins: [react(), tailwindcss()],
})
