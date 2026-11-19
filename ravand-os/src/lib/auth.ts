import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db';

const COOKIE = 'ravand_session';
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-insecure-secret');

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 60 * 60 * 24 * 7 });
}
export function destroySession() { cookies().delete(COOKIE); }

export const getUser = cache(async () => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return await prisma.user.findFirst({ where: { id: String(payload.uid), active: true, deletedAt: null } });
  } catch { return null; }
});
export async function requireUser() {
  const u = await getUser();
  if (!u) redirect('/login');
  return u;
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;
