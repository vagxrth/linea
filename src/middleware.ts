import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";
import { isBypassRoute, isProtectedRoute, isPublicRoute } from "./lib/permissions";

const BypassMatcher = createRouteMatcher(isBypassRoute);
const PublicMatcher = createRouteMatcher(isPublicRoute);
const ProtectedMatcher = createRouteMatcher(isProtectedRoute);
 
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

    return;

}, {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
});
 
export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};