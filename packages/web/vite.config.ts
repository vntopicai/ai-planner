import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const webPort = Number.parseInt(env.VITE_WEB_PORT || env.AI_PLANNER_WEB_PORT || '5173', 10)
  const apiOrigin = env.VITE_AI_PLANNER_API_ORIGIN || env.AI_PLANNER_API_ORIGIN || 'http://localhost:5174'

  return {
    plugins: [react()],
    server: {
      port: Number.isNaN(webPort) ? 5173 : webPort,
      proxy: {
        '/api/deepwiki': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/api/skills': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/api/plan': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
