type RuntimeGroup = {
  web: {
    port: string
  }
  api: {
    origin: string
  }
}

const DEFAULT_RUNTIME: RuntimeGroup = {
  web: {
    port: '5173',
  },
  api: {
    origin: 'http://localhost:5174',
  },
}

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function getRuntimeConfig(): RuntimeGroup {
  return {
    web: {
      port: readEnv('VITE_WEB_PORT') ?? DEFAULT_RUNTIME.web.port,
    },
    api: {
      origin: readEnv('VITE_AI_PLANNER_API_ORIGIN') ?? DEFAULT_RUNTIME.api.origin,
    },
  }
}
