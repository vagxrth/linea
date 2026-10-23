'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"

// Shown in place of a page that throws while rendering. The root layout stays, so the app's
// providers and toasts keep working.
const ErrorPage = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    const router = useRouter()
    const [retrying, startRetry] = useTransition()

    useEffect(() => {
        console.error(error)
    }, [error])

    // Refreshing fetches the page from the server again, so an error thrown there can clear too,
    // not only one thrown in the browser
    const retry = () => startRetry(() => {
        router.refresh()
        reset()
    })

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
                    <p className="text-sm text-muted-foreground">
                        This page hit an error. Try again, and if it keeps happening, go back to your dashboard.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={retry} disabled={retrying}>
                        {retrying ? 'Trying again...' : 'Try again'}
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/dashboard">Go to your dashboard</Link>
                    </Button>
                </div>
                {/* Matches the error in the server logs; production hides the message itself */}
                {error.digest && (
                    <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
                )}
            </div>
        </div>
    )
}

export default ErrorPage
