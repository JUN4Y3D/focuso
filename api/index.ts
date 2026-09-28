// Vercel Function entrypoint for the existing Express API.
// The app module is inside server/, so Vercel traces and emits it with its
// dependency graph; the root server.ts remains local-listener bootstrap only.
import app from '../server/app.js'

export default app
