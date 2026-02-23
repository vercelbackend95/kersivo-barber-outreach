import crypto from 'node:crypto';

export function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
