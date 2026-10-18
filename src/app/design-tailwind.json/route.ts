import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

// The stylesheets that generated designs are compiled with in the browser (src/lib/design-css.ts).
// Built once at build time from the installed packages and Linea's own theme file.
export const dynamic = "force-static"

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8")

export async function GET() {
    return NextResponse.json({
        "tailwindcss/theme.css": await read("node_modules/tailwindcss/theme.css"),
        "tailwindcss/utilities.css": await read("node_modules/tailwindcss/utilities.css"),
        "tw-animate-css": await read("node_modules/tw-animate-css/dist/tw-animate.css"),
        "./tailwind-theme.css": await read("src/app/tailwind-theme.css"),
    })
}
