import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './server/app.js'
import { getSupabaseConfig, verifySupabaseConnection } from './server/lib/supabaseAdmin.js'

export {
  app,
  checkAdminMutationRateLimit,
  checkOrderRateLimit,
  checkRateLimit,
  getClientIp,
  resetOrderRateLimitForTesting,
} from './server/app.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 3000

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')))
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'))
    })
  }

  const server = app.listen(port, '0.0.0.0', async () => {
    console.log(`Server running on http://0.0.0.0:${port}`)
    const sbConfig = getSupabaseConfig()
    if (sbConfig) {
      const conn = await verifySupabaseConnection()
      console.log(`[Supabase Admin] ${conn.message}`)
    } else {
      console.log('[Supabase Admin] Ready for credentials (set SUPABASE_URL and SUPABASE_SECRET_KEY to connect)')
    }
  })

  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}. Closing HTTP server gracefully...`)
    server.close(() => {
      console.log('[Server] HTTP server closed.')
      process.exit(0)
    })

    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.')
      process.exit(1)
    }, 10000).unref()
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
