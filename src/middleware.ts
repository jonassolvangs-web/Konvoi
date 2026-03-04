import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Role-route mapping
    const roleRoutes: Record<string, string> = {
      '/admin': 'ADMIN',
      '/motebooker': 'MOTEBOOKER',
      '/feltselger': 'FELTSELGER',
      '/tekniker': 'TEKNIKER',
    };

    // Check if route requires specific role
    for (const [prefix, requiredRole] of Object.entries(roleRoutes)) {
      if (pathname.startsWith(prefix)) {
        const activeRole = token?.activeRole as string;
        const roles = (token?.roles as string[]) || [];

        // If no active role and multiple roles, go to role selection
        if (!activeRole && roles.length > 1) {
          return NextResponse.redirect(new URL('/velg-rolle', req.url));
        }

        // Check if active role matches required role
        const effectiveRole = activeRole || roles[0];
        if (effectiveRole !== requiredRole) {
          return NextResponse.redirect(new URL('/velg-rolle', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/auth/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!auth|login|api/auth|api/demo-video|_next/static|_next/image|favicon.ico).*)',
  ],
};
