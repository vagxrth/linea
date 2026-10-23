'use client'

import { Geist } from "next/font/google"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import "./globals.css"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

// Replaces the root layout when the layout itself throws, so it brings its own html, body,
// styles and font, and keeps the dark theme the layout forces
const GlobalError = ({ error }: { error: Error & { digest?: string } }) => {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <html lang="en" className="dark">
            <body className={`${geistSans.variable} antialiased`}>
                {/* The layout's metadata is gone too, so the tab's title comes from here */}
                <title>Linea</title>
                <div className="min-h-screen bg-background flex items-center justify-center p-6">
                    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
                            <p className="text-sm text-muted-foreground">
                                Linea couldn&apos;t load. Try again in a moment.
                            </p>
                        </div>
                        {/* A full reload, since the layout that failed has to load again too */}
                        <Button onClick={() => window.location.reload()}>Try again</Button>
                        {error.digest && (
                            <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
                        )}
                    </div>
                </div>
            </body>
        </html>
    )
}

export default GlobalError
