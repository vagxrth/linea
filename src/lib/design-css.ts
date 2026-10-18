import type { compile } from "tailwindcss"

type DesignCompiler = Awaited<ReturnType<typeof compile>>

// Same Tailwind setup as globals.css, minus the base styles, which the design frame already has from the app
const INPUT = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "tw-animate-css";
@import "./tailwind-theme.css";`

let stylesheets: Promise<Record<string, string>> | null = null

const loadStylesheets = () => {
    stylesheets ??= fetch("/design-tailwind.json")
        .then((res) => {
            if (!res.ok) throw new Error(`Design stylesheets failed to load: ${res.status}`)
            return res.json() as Promise<Record<string, string>>
        })
        .catch((error) => {
            // Let the next design try again
            stylesheets = null
            throw error
        })
    return stylesheets
}

// The app's stylesheet only has the Tailwind classes Linea's own code uses. Generated designs can use any
// class, so each design gets CSS compiled for exactly the classes it uses.
export const createDesignCompiler = async (): Promise<DesignCompiler> => {
    const [{ compile }, sheets] = await Promise.all([import("tailwindcss"), loadStylesheets()])
    return compile(INPUT, {
        loadStylesheet: async (id, base) => {
            if (!(id in sheets)) throw new Error(`Unknown design stylesheet: ${id}`)
            return { path: id, base, content: sheets[id] }
        },
    })
}

export const designClasses = (page: Document) => {
    const classes = new Set<string>()
    page.body.querySelectorAll("[class]").forEach((element) => element.classList.forEach((name) => classes.add(name)))
    return [...classes]
}
