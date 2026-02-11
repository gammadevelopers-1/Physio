import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Dashboard paths that require authentication
const PROTECTED_PREFIX = '/dashboard';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected dashboard route
  if (pathname.includes(PROTECTED_PREFIX)) {
    const session = request.cookies.get('session');

    if (!session?.value) {
      // No session cookie → redirect to sign-in
      const locale = pathname.split('/')[1] || 'en';
      const redirectUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/${locale}/signin?redirect=${redirectUrl}`, request.url)
      );
    }

    // Authenticated — let the request proceed without intl middleware rewriting
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)',],
};
