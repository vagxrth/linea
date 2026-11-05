import Link from "next/link"
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server"
import { Button } from "@/components/ui/button"

// Shown for addresses that match no page, and wherever a page calls notFound(). It offers the
// dashboard only to someone signed in: the dashboard sends anyone else to sign in.
const NotFound = async () => {
    const signedIn = await isAuthenticatedNextjs().catch(() => false)

    return (
        <div data-app-chrome className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-6 text-center">
                <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">404</p>
                    <h1 className="font-serif text-5xl leading-none tracking-tight text-foreground">Page not found</h1>
                    <p className="text-[0.9375rem]/relaxed text-muted-foreground">
                        This page doesn&apos;t exist, or it has moved.
                    </p>
                </div>
                <div className="flex gap-2">
                    {signedIn ? (
                        <>
                            <Button asChild shape="pill">
                                <Link href="/dashboard">Go to your dashboard</Link>
                            </Button>
                            <Button asChild variant="outline" shape="pill">
                                <Link href="/">Home</Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button asChild shape="pill">
                                <Link href="/">Go home</Link>
                            </Button>
                            <Button asChild variant="outline" shape="pill">
                                <Link href="/auth/signin">Sign in</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default NotFound
