// Vercel Function entrypoint for the existing Express API.
// Keep the extension explicit: this project also has a server/ directory, and
// extensionless ESM resolution on Vercel would otherwise target that directory.
import app from '../server.ts'

export default app
