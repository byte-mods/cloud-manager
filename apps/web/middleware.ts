import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If the user is not authenticated and trying to access protected routes
    if (!token && path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // If authenticated and trying to access auth pages, redirect to dashboard
    if (token && (path === "/login" || path === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Public paths that don't require authentication
        const publicPaths = ["/login", "/register", "/forgot-password", "/api/auth"];
        const isPublicPath = publicPaths.some((p) => path === p || path.startsWith(`${p}/`));

        if (isPublicPath) {
          return true;
        }

        // Protected paths require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
