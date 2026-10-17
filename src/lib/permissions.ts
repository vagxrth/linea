export const isBypassRoute = [
    "/api/auth(.*)",
    "/convex(.*)",
];

export const isPublicRoute = [
    "/auth(.*)",
    "/",
]

export const isProtectedRoute = [
    "/dashboard(.*)",
    "/billing(.*)",
]