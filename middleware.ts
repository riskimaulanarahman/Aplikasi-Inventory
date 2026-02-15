import { NextRequest, NextResponse } from 'next/server';

const AUTH_PAGES = ['/login', '/register'];
const AUTH_TOKEN_COOKIE = process.env.AUTH_TOKEN_COOKIE ?? process.env.NEXT_PUBLIC_AUTH_TOKEN_COOKIE ?? 'tw_access_token';

function getApiBaseUrl() {
  const base = process.env.API_BASE_URL_SERVER ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error('API_BASE_URL_SERVER or NEXT_PUBLIC_API_BASE_URL must be configured.');
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/t') || pathname.startsWith('/platform');
}

function toLoginRedirect(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return loginUrl;
}

async function hasValidSession(token: string | null) {
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value ?? null;
  const isAuthenticated = await hasValidSession(token);
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return NextResponse.redirect(toLoginRedirect(request));
  }

  if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/t', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
