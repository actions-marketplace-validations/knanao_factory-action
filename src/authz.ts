import type { Author } from './trigger.js'

export interface AuthzOptions {
  allowedAssociations: string[]
  permissionFallback: boolean
  /** Returns the collaborator permission ('admin' | 'write' | 'read' | 'none'). */
  getPermission: (login: string) => Promise<string>
}

export interface AuthzResult {
  allowed: boolean
  reason: string
}

/**
 * author_association first (no API call). If it is not in the allowlist, fall
 * back to the collaborator permission API once. This covers org members whose
 * membership is private and who therefore show up as CONTRIBUTOR or NONE.
 */
export async function authorize(
  author: Author,
  opts: AuthzOptions
): Promise<AuthzResult> {
  const association = (author.association ?? 'NONE').toUpperCase()
  if (opts.allowedAssociations.includes(association)) {
    return { allowed: true, reason: `author_association ${association}` }
  }
  if (!opts.permissionFallback || !author.login) {
    return { allowed: false, reason: `author_association ${association}` }
  }

  let permission = 'none'
  try {
    permission = await opts.getPermission(author.login)
  } catch {
    // 404 means the user is not a collaborator.
  }
  const allowed = permission === 'admin' || permission === 'write'
  return {
    allowed,
    reason: `author_association ${association}, permission ${permission}`
  }
}
