import { NextRequest, NextResponse } from 'next/server'
import { decryptSession } from '@/modules/auth/utils'
const ROLE_ROUTE_MAP: Record<string, string[]> = {
  '/admin': ['ADMIN'],
  '/manager/bookings': ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  '/manager/board': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'],
  '/manager/refunds': ['ADMIN', 'MANAGER'],
  '/manager': ['ADMIN', 'MANAGER'],
  '/housekeeper': ['ADMIN', 'MANAGER', 'HOUSEKEEPER'],
  '/dashboard': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'CUSTOMER'],
  '/profile': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'CUSTOMER'],
  '/book': ['CUSTOMER'],
  '/bookings': ['CUSTOMER'],
}

const SESSION_COOKIE = 'session'

const PROTECTED_ROUTES = ['/dashboard', '/admin', '/manager', '/housekeeper', '/profile', '/book', '/bookings']
const AUTH_ROUTES = [
  '/auth/customer/login',
  '/auth/staff/login',
  '/auth/staff/forgot-password',
  '/auth/staff/reset-password',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = await decryptSession(token)

  const isChangePasswordRoute = pathname === '/auth/staff/change-password'

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && session && !isChangePasswordRoute) {
    if (session.mustChangePassword) {
       return NextResponse.redirect(new URL('/auth/staff/change-password', req.url))
    }
    if (session.role === 'CUSTOMER') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Require authentication for protected routes
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/auth/staff/login', req.url))
  }
  
  // Enforce password change for staff
  if (session?.mustChangePassword && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/staff/change-password', req.url))
  }

  // Role-based route guard
  if (isProtectedRoute && session) {
    const sortedRoutes = Object.entries(ROLE_ROUTE_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [route, roles] of sortedRoutes) {
      if (pathname.startsWith(route)) {
        if (!roles.includes(session.role)) {
          return NextResponse.redirect(new URL('/dashboard', req.url));
        }
        break; // Match found, don't check shorter routes
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/housekeeper/:path*',
    '/profile/:path*',
    '/book/:path*',
    '/bookings/:path*',
    '/auth/:path*',
  ],
}
