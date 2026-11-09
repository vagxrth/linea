import type { StyleGuide } from "@/redux/api/style-guide"
import { OUTLINE_VERSION, type FrameOutline, type OutlineNode } from "@/lib/wireframe-outline"

// Three projects for scripts/eval-generation.ts, each a style guide, a wireframe outline and the
// images it has: a landing page, a dense dashboard and a settings form. None of it is real user data.

export type EvalFixture = {
    name: string
    guide: StyleGuide
    outline: FrameOutline
    images: { url: string; width: number; height: number }[]
    // A chat request for the refine round of a live run
    refine: string
}

const swatch = (name: string, hexColor: string, description = "") => ({ name, hexColor, description })
const style = (name: string, fontFamily: string, fontSize: string, fontWeight: string, lineHeight: string, letterSpacing?: string) =>
    ({ name, fontFamily, fontSize, fontWeight, lineHeight, ...(letterSpacing ? { letterSpacing } : {}) })
const box = (id: string, label: string | undefined, x1: number, y1: number, x2: number, y2: number, children?: OutlineNode[]): OutlineNode =>
    ({ id, kind: "box", ...(label ? { label } : {}), box: [x1, y1, x2, y2], ...(children ? { children } : {}) })
const copy = (id: string, text: string, x: number, y: number): OutlineNode => ({ id, kind: "text", text, box: [x, y, x + text.length * 0.8, y + 3] })
const outline = (number: number, width: number, height: number, nodes: OutlineNode[]): FrameOutline =>
    ({ version: OUTLINE_VERSION, frame: { id: `frame-${number}`, number, width, height }, nodes })

// The Veridian demo from the landing page: a plant shop, warm and earthy. Its primary pair (dark text
// on terracotta) is just under 4.5:1, so the contract corrects it.
const landing: EvalFixture = {
    name: "landing",
    guide: {
        theme: "Organic Warmth",
        description: "Warm, earthy palette with soft beige grounds, terracotta and sage.",
        colorSections: [
            { title: "Primary Colors", swatches: [swatch("Background", "#EADED3", "Main page background"), swatch("Foreground", "#343036", "Primary text"), swatch("Primary", "#C58066", "Brand and call-to-action color"), swatch("Primary Foreground", "#343036", "Text on primary")] },
            { title: "Secondary & Accent Colors", swatches: [swatch("Secondary", "#5F9873"), swatch("Secondary Foreground", "#FFFFFF"), swatch("Accent", "#E4B77C"), swatch("Accent Foreground", "#343036")] },
            { title: "UI Component Colors", swatches: [swatch("Card", "#E3D6C9"), swatch("Card Foreground", "#343036"), swatch("Popover", "#E3D6C9"), swatch("Popover Foreground", "#343036"), swatch("Muted", "#E0D4C8"), swatch("Muted Foreground", "#6B6567")] },
            { title: "Utility & Form Colors", swatches: [swatch("Border", "#CDBFB2"), swatch("Input", "#E3D6C9"), swatch("Ring", "#C58066")] },
            { title: "Status & Feedback Colors", swatches: [swatch("Destructive", "#B3261E"), swatch("Destructive Foreground", "#FFFFFF")] },
        ],
        typographySections: [
            { title: "Headings", styles: [style("H1", "Lato", "3rem", "700", "1.15", "-0.02em"), style("H2", "Lato", "2.25rem", "700", "1.2", "-0.01em"), style("H3", "Lato", "1.5rem", "600", "1.3")] },
            { title: "Body", styles: [style("Body", "Lato", "1.0625rem", "400", "1.6"), style("Small", "Lato", "0.875rem", "400", "1.5")] },
            { title: "UI Elements", styles: [style("Button", "Lato", "1rem", "600", "1.2", "0.01em"), style("Label", "Lato", "0.875rem", "500", "1.4")] },
        ],
    } as StyleGuide,
    outline: outline(1, 940, 553, [
        box("nav01", "navbar", 2, 2.5, 98, 10, [{ id: "logo01", kind: "circle", box: [3, 3.8, 6, 7.5] }]),
        { id: "head01", kind: "text", label: "headline", box: [3, 15, 10.6, 17.5] },
        { id: "scrib01", kind: "scribble", box: [3, 18.8, 30, 20.6] },
        box("btn001", "button", 3, 37.5, 18, 43.8),
        { id: "hero01", kind: "image", label: "hero image", box: [50, 13.8, 96, 51.2] },
        box("card01", "card", 3, 62.5, 33, 93.8),
        box("card02", "card", 35, 62.5, 65, 93.8),
        box("card03", "card", 67, 62.5, 97, 93.8),
    ]),
    images: [
        { url: "https://eval.invalid/hanging-plant.webp", width: 1200, height: 1500 },
        { url: "https://eval.invalid/plant-shelf.webp", width: 1600, height: 1200 },
    ],
    refine: "Give the hero section a soft sage green background, a light tint of the main button's green. Keep the headline, text and button colors, the fonts and the layout exactly as they are.",
}

// An analytics screen: sidebar, search header, four figures, a chart and a table. Its muted text and
// its accent pair fail contrast as given.
const dashboard: EvalFixture = {
    name: "dense dashboard",
    guide: {
        theme: "Cool Analytics",
        description: "Crisp, cool neutrals with a deep teal accent for a data-heavy tool.",
        colorSections: [
            { title: "Primary Colors", swatches: [swatch("Background", "#F8FAFC"), swatch("Foreground", "#0F172A"), swatch("Primary", "#0F766E"), swatch("Primary Foreground", "#FFFFFF")] },
            { title: "Secondary & Accent Colors", swatches: [swatch("Secondary", "#E2E8F0"), swatch("Secondary Foreground", "#0F172A"), swatch("Accent", "#5EEAD4"), swatch("Accent Foreground", "#FFFFFF")] },
            { title: "UI Component Colors", swatches: [swatch("Card", "#FFFFFF"), swatch("Card Foreground", "#0F172A"), swatch("Popover", "#FFFFFF"), swatch("Popover Foreground", "#0F172A"), swatch("Muted", "#F1F5F9"), swatch("Muted Foreground", "#94A3B8")] },
            { title: "Utility & Form Colors", swatches: [swatch("Border", "#E2E8F0"), swatch("Input", "#E2E8F0"), swatch("Ring", "#0F766E")] },
            { title: "Status & Feedback Colors", swatches: [swatch("Destructive", "#DC2626"), swatch("Destructive Foreground", "#FFFFFF")] },
        ],
        typographySections: [
            { title: "Headings", styles: [style("H1", "Inter", "1.75rem", "600", "1.25", "-0.01em"), style("H2", "Inter", "1.25rem", "600", "1.3"), style("H3", "Inter", "1rem", "600", "1.4")] },
            { title: "Body", styles: [style("Body", "Inter", "0.9375rem", "400", "1.5"), style("Small", "Inter", "0.8125rem", "400", "1.4")] },
            { title: "UI Elements", styles: [style("Button", "Inter", "0.875rem", "500", "1.2"), style("Label", "Inter", "0.75rem", "500", "1.3", "0.02em")] },
        ],
    } as StyleGuide,
    outline: outline(2, 1440, 900, [
        box("side01", "sidebar", 0, 0, 16, 100, [
            copy("nav-a", "Overview", 2, 10), copy("nav-b", "Orders", 2, 16), copy("nav-c", "Customers", 2, 22), copy("nav-d", "Reports", 2, 28), copy("nav-e", "Settings", 2, 34),
        ]),
        box("head01", "header", 18, 2, 98, 9, [box("srch01", "search", 20, 3, 50, 8), { id: "avat01", kind: "circle", label: "avatar", box: [94, 3, 97, 8] }]),
        box("kpi001", "stat", 18, 12, 37, 24),
        box("kpi002", "stat", 39, 12, 58, 24),
        box("kpi003", "stat", 60, 12, 79, 24),
        box("kpi004", "stat", 81, 12, 98, 24),
        box("chrt01", "chart", 18, 27, 98, 58),
        box("tabl01", "table", 18, 61, 98, 97, [1, 2, 3, 4, 5].map((row) => ({ id: `row-${row}`, kind: "line" as const, box: [20, 62 + row * 6, 96, 62.5 + row * 6] as [number, number, number, number] }))),
    ]),
    images: [],
    refine: "Make the table rows more compact and add a status column.",
}

// An account settings form, with a style guide from before swatches were named after their roles:
// creative names, two color sections missing, and unnamed type styles
const settings: EvalFixture = {
    name: "settings form",
    guide: {
        theme: "Quiet Paper",
        description: "Paper whites, ink and moss for calm, focused forms.",
        colorSections: [
            { title: "Primary Colors", swatches: [swatch("Paper", "#FBFAF7"), swatch("Ink", "#1D1D1F"), swatch("Moss", "#4F6F52"), swatch("Paper White", "#FFFFFF")] },
            { title: "Secondary & Accent Colors", swatches: [swatch("Fog", "#E7E5E0"), swatch("Charcoal", "#3A3A3C"), swatch("Clay", "#C9A27E"), swatch("Sand", "#F4EDE4")] },
            { title: "Status & Feedback Colors", swatches: [swatch("Rust", "#A3412D", "Error messages")] },
        ],
        typographySections: [
            { title: "Display", styles: [style("Title", "'Source Serif 4', serif", "2rem", "600", "1.2")] },
            { title: "Text", styles: [style("Regular", "Work Sans", "1rem", "400", "1.55")] },
            { title: "Controls", styles: [] },
        ],
    } as unknown as StyleGuide,
    outline: outline(3, 1200, 900, [
        copy("ttl001", "Account settings", 5, 5),
        box("form01", "form", 5, 14, 65, 92, [
            copy("lbl-n", "Name", 7, 17), box("inp-n", "input", 7, 21, 60, 27),
            copy("lbl-e", "Email", 7, 31), box("inp-e", "input", 7, 35, 60, 41),
            box("tgl-1", "toggle", 7, 50, 11, 54), copy("tgl-1t", "Email me when a design is ready", 13, 50.5),
            box("tgl-2", "toggle", 7, 58, 11, 62), copy("tgl-2t", "Weekly summary", 13, 58.5),
            box("save01", "button", 7, 78, 25, 86, [copy("save-t", "Save changes", 9, 80)]),
        ]),
        box("plan01", "card", 70, 14, 95, 46, [copy("plan-t", "Plan: Free", 72, 17), box("upgr01", "button", 72, 36, 92, 42)]),
    ]),
    images: [],
    refine: "Put the two toggles side by side on wide screens.",
}

export const EVAL_FIXTURES: EvalFixture[] = [landing, dashboard, settings]
