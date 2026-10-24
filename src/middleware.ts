import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isBypassRoute, isProtectedRoute, isPublicRoute } from "./lib/permissions";
import { scriptPolicy } from "./lib/script-policy";

const BypassMatcher = createRouteMatcher(isBypassRoute);
const PublicMatcher = createRouteMatcher(isPublicRoute);
const ProtectedMatcher = createRouteMatcher(isProtectedRoute);

// Each request gets a fresh random nonce. Next.js reads it from the policy on the request and puts it
// on the page's scripts, and the browser gets the same policy, so it runs only those and linea's own.
// The request headers are copied, so cookies refreshed by Convex Auth still reach the page.
const withScriptPolicy = (req: NextRequest) => {
    const nonce = btoa(crypto.randomUUID());
    const policy = scriptPolicy(nonce);
    const headers = new Headers(req.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", policy);
    return response;
};

export default convexAuthNextjsMiddleware(async (req, { convexAuth }) => {
    if (BypassMatcher(req)) {
        return;
    }

    const auth = await convexAuth.isAuthenticated();

    if (PublicMatcher(req) && auth) {
        return nextjsMiddlewareRedirect(req, "/dashboard");
    }

    if (ProtectedMatcher(req) && !auth) {
        return nextjsMiddlewareRedirect(req, "/auth/signin");
    }

    return withScriptPolicy(req);

}, {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
});
 
export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};