// Vercel Function entrypoint for the existing Express API.
// Importing the app does not call app.listen(); Vercel owns the HTTP lifecycle.
import app from '../server'

export default app
