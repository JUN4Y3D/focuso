import { Request, Response, NextFunction } from 'express'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

export interface AuthenticatedAdmin {
  id: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthenticatedAdmin
    }
  }
}

/**
 * Express middleware to strictly require and verify an active FOCUSO administrator.
 *
 * Security Model:
 * 1. Reads Bearer token from 'Authorization: Bearer <token>'
 * 2. Verifies token with Supabase Auth (getUser) using the service role admin client
 * 3. Identifies the user UUID and email safely
 * 4. Queries public.admin_users for (user_id = id AND active = true)
 * 5. Attaches safe admin identity to req.adminUser
 * 6. Returns 401 Unauthorized for missing/invalid/expired tokens
 * 7. Returns 403 Forbidden if user is authenticated in Supabase but not an active admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header.',
    })
    return
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid bearer token.',
    })
    return
  }

  const adminClient = getSupabaseAdmin()
  if (!adminClient) {
    console.error('[requireAdmin] Supabase Admin client is not configured.')
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service is unavailable.',
    })
    return
  }

  try {
    // 1. Verify token with Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !authData?.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.',
      })
      return
    }

    const userId = authData.user.id
    const userEmail = authData.user.email || ''

    // 2. Query admin_users table for active status
    const { data: adminRecord, error: adminQueryError } = await adminClient
      .from('admin_users')
      .select('user_id, active')
      .eq('user_id', userId)
      .maybeSingle()

    if (adminQueryError) {
      console.error('[requireAdmin] Database error querying admin_users:', adminQueryError.message)
      // Check if table missing
      if (adminQueryError.message?.includes('does not exist') || adminQueryError.code === '42P01') {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Admin authorization table is not configured. Please apply database migrations.',
        })
        return
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify admin status.',
      })
      return
    }

    if (!adminRecord || adminRecord.active !== true) {
      // Authenticated with Supabase, but NOT an active administrator
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have administrator access.',
      })
      return
    }

    // Attach safe admin identity
    req.adminUser = {
      id: userId,
      email: userEmail,
    }

    next()
  } catch (err: any) {
    console.error('[requireAdmin] Unexpected exception:', err?.message || err)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify authorization.',
    })
  }
}
