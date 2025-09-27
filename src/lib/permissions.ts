export const isBypassRoute = [
    "/api/polar/webhook",
    "/api/inngest(.*)",
    "/api/auth(.*)",
    "/convex(.*)",
];

export const isPublicRoute = [
    "/auth(.*)",
    "/",
]

export const isProtectedRoute = [
    "/dashboard(.*)",
]