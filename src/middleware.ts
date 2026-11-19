import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/login', '/setup', '/logo.png'];
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  const token = req.cookies.get('ravand_session')?.value;
  try {
    if (!token) throw new Error('no token');
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-insecure-secret'));
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
