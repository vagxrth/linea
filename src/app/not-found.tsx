import Link from "next/link"
import { Button } from "@/components/ui/button"

// Shown for addresses that match no page, and wherever a page calls notFound()
const NotFound = () => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">404</p>
                    <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
                    <p className="text-sm text-muted-foreground">
                        This page doesn&apos;t exist, or it has moved.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href="/dashboard">Go to your dashboard</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">Home</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default NotFound
