import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export class RequestAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'RequestAuthError';
  }
}

export async function verifyRequestUser(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new RequestAuthError('Please sign in to continue.', 401);

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
    if (!decoded.email || decoded.email_verified !== true) {
      throw new RequestAuthError('Verify your email before continuing.', 403);
    }
    return decoded;
  } catch (error) {
    if (error instanceof RequestAuthError) throw error;
    throw new RequestAuthError('Your session has expired. Please sign in again.', 401);
  }
}

export async function verifyAdminRequest(request: Request): Promise<DecodedIdToken> {
  const decoded = await verifyRequestUser(request);
  const allowedEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!decoded.email || !allowedEmails.includes(decoded.email.toLowerCase())) {
    throw new RequestAuthError('You are not authorized to perform this action.', 403);
  }

  return decoded;
}
