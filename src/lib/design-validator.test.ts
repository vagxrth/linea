import { describe, expect, it } from "vitest"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { BANNED_COPY_WORDS } from "../prompts/design"
import { buildDesignContract } from "./design-contract"
import { BANNED_PATTERNS, errorCount, issueSummary, REPAIR_LIST_LIMIT, repairProblems, validate, type Issue, type ValidationContext } from "./design-validator"
import { DASHBOARD_FAILING, DASHBOARD_PASSING, DASHBOARD_REFINE_FAILING, DASHBOARD_STYLE, LANDING_FAILING } from "./design-validator.fixtures"

const [landing, dashboard] = EVAL_FIXTURES.map((fixture) => buildDesignContract(fixture.guide))

const ofKind = (issues: Issue[], kind: Issue["kind"]) => issues.filter((issue) => issue.kind === kind)

// A dashboard page with `body` inside its card, in the dashboard's contract
const card = (body: string) => `<div data-generated-ui>${DASHBOARD_STYLE}<div class="c-bg c-fg"><section id="panel" class="c-card-bg c-card-fg p-4">${body}</section></div></div>`

const check = (html: string, context: ValidationContext = { mode: "initial" }) => validate(html, dashboard, context)

describe("validate, on the designs the live eval flagged", () => {
    it("finds the white-on-white status text, at 1.00:1, wherever it repeats", () => {
        const [issue, ...others] = ofKind(check(DASHBOARD_FAILING), "contrast")
        expect(others).toEqual([])
        expect(issue).toMatchObject({ severity: "error", count: 3 })
        expect(issue.message).toBe(
            'Contrast 1.00:1, under 4.5:1: text "Completed" in <span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg"> in #orders-table (3 places) is #FFFFFF on #FFFFFF. ' +
            "Use c-card-fg on this c-card-bg, or give the text its own matching pair (c-primary-bg with c-primary-fg)."
        )
    })

    it("finds the made-up customers and the chart placeholder in the same dashboard", () => {
        const issues = check(DASHBOARD_FAILING)
        expect(ofKind(issues, "name")).toEqual([expect.objectContaining({ severity: "error", count: 3, message: expect.stringContaining('"Alice Smith", "Bob Johnson", "Carol Davis" (in #orders-table)') })])
        expect(ofKind(issues, "placeholder")).toEqual([expect.objectContaining({ severity: "error", message: expect.stringContaining('Placeholder text "Chart placeholder" in <p class="t-body c-muted-fg"> in #revenue-chart') })])
        expect(errorCount(issues)).toBe(3)
    })

    it("finds every banned word on the landing page, the hero image that collapses, and the inline SVG icons", () => {
        const issues = validate(LANDING_FAILING, landing, { mode: "initial", width: 940 })
        expect(ofKind(issues, "copy").map((issue) => issue.message.match(/^Banned word "([^"]+)"/)![1])).toEqual(["Discover", "Explore", "curated", "unique", "perfect"])
        expect(ofKind(issues, "image-size")).toEqual([expect.objectContaining({ severity: "error", message: expect.stringContaining('<img class="w-full rounded-2xl object-cover" alt="A pothos trailing from a hanging pot" data-slot="slot-1"> in #hero-section has no height or aspect ratio') })])
        expect(ofKind(issues, "inline-svg")).toEqual([expect.objectContaining({ severity: "error", count: 3, message: expect.stringMatching(/^3 inline <svg>s \(in #features\): the design's frame removes inline SVG/) })])
        expect(ofKind(issues, "contrast")).toEqual([])
    })

    it("finds the refine's second Status column and its off-contract green, and leaves what the page already had as warnings", () => {
        const issues = check(DASHBOARD_REFINE_FAILING, { mode: "refine", previousHtml: DASHBOARD_FAILING })
        const errors = issues.filter((issue) => issue.severity === "error")
        expect(errors.map((issue) => issue.key).sort()).toEqual(["color|#166534", "color|#DCFCE7", "duplicate-column|status"])
        expect(errors.find((issue) => issue.kind === "duplicate-column")!.message).toBe('Table #orders-table has the column "Status" twice. Keep one, and drop the others from the header and every row.')
        expect(errors.find((issue) => issue.key === "color|#DCFCE7")!.message).toBe("Color #DCFCE7 isn't in the design contract: [data-generated-ui] .status-paid { background-color }. Use the contract's colors, through the .c-* classes.")
        // The white-on-white pills, the names and the placeholder were in the page before the refine
        const warnings = issues.filter((issue) => issue.severity === "warning")
        expect(warnings.map((issue) => issue.kind).sort()).toEqual(["contrast", "name", "placeholder"])
        for (const warning of warnings) expect(warning.message).toMatch(/\(It was already there\.\)$/)
    })

    it("passes the same dashboard done right: matching pairs, a chart from divs, customers by role", () => {
        expect(check(DASHBOARD_PASSING)).toEqual([])
    })
})

describe("contrast", () => {
    it("needs 4.5:1 for normal text and 3:1 for large or bold text", () => {
        // #8A8A8A on white is about 3.45:1
        const page = card('<p style="color: #8A8A8A">Small print</p><p style="color: #8A8A8A; font-size: 24px">Big heading</p><p style="color: #8A8A8A; font-size: 19px; font-weight: 700">Bold line</p>')
        const failing = ofKind(check(page), "contrast")
        expect(failing.map((issue) => issue.message.match(/text "([^"]+)"/)![1])).toEqual(["Small print"])
        expect(failing[0].message).toMatch(/^Contrast 3\.\d\d:1, under 4\.5:1/)
    })

    it("reads Tailwind color classes, inline styles and see-through colors", () => {
        const issues = ofKind(check(card('<span class="text-white">One</span><span style="color: rgba(15, 23, 42, 0.2)">Two</span><span class="bg-slate-900 text-white">Three</span>')), "contrast")
        expect(issues.map((issue) => issue.message.match(/text "([^"]+)"/)![1])).toEqual(["One", "Two"])
    })

    it("leaves out text it can't see behind, and text that isn't shown or is disabled", () => {
        const page = card('<div style="background-image: linear-gradient(#000, #fff)"><p class="text-white">On a gradient</p></div><p class="sr-only text-white">Hidden</p><button disabled class="text-white">Off</button>')
        expect(ofKind(check(page), "contrast")).toEqual([])
    })
})

describe("colors outside the contract", () => {
    it("finds them in the <style> block, inline styles and Tailwind classes, and names Linea's own theme colors", () => {
        const page = card('<style>.badge { border: 1px solid #22C55E }</style><span class="badge bg-green-100 text-teal-600">A</span><span style="background-color: #FEF3C7">B</span><button class="bg-primary">C</button>')
        const issues = ofKind(check(page), "color")
        expect(issues.map((issue) => issue.key).sort()).toEqual(["color|#009689", "color|#22C55E", "color|#DCFCE7", "color|#E5E5E5", "color|#FEF3C7"])
        expect(issues.find((issue) => issue.key === "color|#E5E5E5")!.message).toContain("bg-primary (Linea's own theme color)")
    })

    it("allows the contract's colors in any form and opacity, and see-through black or white", () => {
        const page = card('<style>.soft { background: rgba(15, 118, 110, 0.1); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); border-color: #0f766e }</style><div class="soft bg-black/40 border-white/20"><p class="c-primary-fg c-primary-bg">A</p></div>')
        expect(ofKind(check(page), "color")).toEqual([])
    })

    it("are only warnings when no one can see them: hover and focus colors, in an inert frame", () => {
        const page = card('<style>.cta:hover { background-color: #0B5F58 }</style><a class="cta c-primary-bg c-primary-fg hover:bg-teal-700 focus-visible:ring-sky-500">Go</a>')
        const issues = ofKind(check(page), "color")
        expect(issues.map((issue) => issue.key).sort()).toEqual(["color|#00786F", "color|#00A6F4", "color|#0B5F58"])
        expect(issues.every((issue) => issue.severity === "warning")).toBe(true)
        // The same color shown somewhere too is an error
        expect(ofKind(check(card('<style>.cta:hover { color: #0B5F58 }</style><p style="color: #0B5F58">A</p>')), "color")[0].severity).toBe("error")
    })

    it("are only warnings on a refine that asks for a color, and colors the page had before aren't new", () => {
        const page = card('<section style="background-color: #D8E6DC"><p>A</p></section>')
        expect(ofKind(check(page, { mode: "refine", colorRequested: true }), "color")[0].severity).toBe("warning")
        expect(ofKind(check(page, { mode: "refine", colorRequested: false }), "color")[0].severity).toBe("error")
        expect(ofKind(check(page, { mode: "refine", previousHtml: page }), "color")[0].severity).toBe("warning")
    })
})

describe("copy", () => {
    it("bans every word the copy policy bans, read from its one list", () => {
        expect(BANNED_PATTERNS.map((entry) => entry.word)).toEqual(BANNED_COPY_WORDS.map((word) => word.replace(/\s*\(.*\)$/, "")))
    })

    it("catches the forms of a word the policy means, and not words that only start the same", () => {
        const found = (text: string) => ofKind(check(card(`<p>${text}</p>`)), "copy").map((issue) => issue.message.match(/^Banned word "([^"]+)"/)![1])
        expect(found("Explored, exploring, uniquely made, perfectly potted")).toEqual(["Explored", "uniquely", "perfectly"])
        expect(found("A transformation, transformative and cutting edge")).toEqual(["transformation", "cutting edge"])
        expect(found("Start your journey")).toEqual(["your journey"])
        expect(found("Elevation 1,200 m, a perfectionist's discovery")).toEqual([])
    })

    it("leaves the words the user wrote themselves, on the wireframe or in their request", () => {
        const page = card("<h1>Explore the menu</h1>")
        expect(ofKind(check(page, { mode: "initial", suppliedText: "Explore the menu" }), "copy")).toEqual([])
        expect(ofKind(check(page, { mode: "initial" }), "copy")).toHaveLength(1)
    })

    it("checks what form fields show, too", () => {
        expect(ofKind(check(card('<input value="Discover more" aria-label="x">')), "copy")).toHaveLength(1)
    })
})

describe("made-up names and placeholders", () => {
    it("finds people's names, initials included, and not places, products or plain words", () => {
        const names = (text: string) => ofKind(check(card(`<p>${text}</p>`)), "name")[0]?.message ?? null
        expect(names("— Sarah K., plant parent")).toContain('"Sarah K."')
        expect(names("Reviewed by María García-López")).toContain('"María García-López"')
        expect(names("Grant Access, Will Smith, Paris Office, Alice Springs Library, Max Users")).toBeNull()
        expect(names('Signed in as <input value="Priya Raman">')).toContain('"Priya Raman"')
    })

    it("leaves a name the user supplied", () => {
        expect(ofKind(check(card("<p>Dr. Maria Lopez</p>"), { mode: "initial", suppliedText: "Dr. Maria Lopez, dentist" }), "name")).toEqual([])
    })

    it("finds lorem ipsum, 'goes here' text, example emails, empty chart boxes and canvases", () => {
        const page = card('<p>Lorem ipsum dolor sit amet</p><p>Your logo goes here</p><p>user@example.com</p><div id="sales-chart" class="h-64 c-muted-bg"></div><canvas id="trend"></canvas>')
        expect(ofKind(check(page), "placeholder").map((issue) => issue.key)).toEqual([
            "placeholder|lorem", "placeholder|goes here", "placeholder|user@example.com", 'placeholder|empty|<div id="sales-chart" class="h-64 c-muted-bg">', "placeholder|canvas",
        ])
    })

    it("doesn't take a chart's own bars, an input's hint or a slot's neutral text for placeholders", () => {
        const page = card('<div id="sales-chart"><div class="chart-bar c-primary-bg" style="height: 40%"></div></div><label for="q">Search</label><input id="q" placeholder="Search orders"><blockquote>Customer quote</blockquote><p>Name, role</p>')
        expect(ofKind(check(page), "placeholder")).toEqual([])
    })
})

describe("table columns", () => {
    const table = (...headers: string[]) => card(`<table id="orders"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody><tr>${headers.map(() => "<td>1</td>").join("")}</tr></tbody></table>`)

    it("finds a column twice in any mode, whatever its case and punctuation", () => {
        expect(ofKind(check(table("Order", "status", "Status:")), "duplicate-column")[0].message).toBe('Table #orders has the column "status" twice. Keep one, and drop the others from the header and every row.')
        expect(ofKind(check(table("", "Order", "")), "duplicate-column")).toEqual([])
    })

    it("finds near-duplicates on a refine only, and only new ones", () => {
        const page = table("Order", "Status", "Order status", "Total", "Totals")
        expect(ofKind(check(page), "duplicate-column")).toEqual([])
        const refine = ofKind(check(page, { mode: "refine" }), "duplicate-column")
        expect(refine.map((issue) => issue.message)).toEqual([
            'Table #orders has the columns "Order" and "Order status", which say the same thing. Keep one, and drop the other from the header and every row.',
            'Table #orders has the columns "Status" and "Order status", which say the same thing. Keep one, and drop the other from the header and every row.',
            'Table #orders has the columns "Total" and "Totals", which say the same thing. Keep one, and drop the other from the header and every row.',
        ])
        expect(ofKind(check(page, { mode: "refine", previousHtml: page }), "duplicate-column").every((issue) => issue.severity === "warning")).toBe(true)
    })
})

describe("images", () => {
    const image = (markup: string) => ofKind(check(card(markup)), "image-size")

    it("passes an image whose box keeps its shape: an aspect ratio, a fixed height, its width and height, or a sized box around it", () => {
        expect(image('<img src="x" alt="a" class="aspect-[4/3] w-full object-cover">')).toEqual([])
        expect(image('<img src="x" alt="a" class="h-48 w-full object-cover">')).toEqual([])
        expect(image('<img src="x" alt="a" width="1200" height="800" class="w-full h-auto">')).toEqual([])
        expect(image('<div class="aspect-video c-muted-bg"><img src="x" alt="a" class="h-full w-full object-cover"></div>')).toEqual([])
        expect(image('<div class="relative h-72"><img src="x" alt="a" class="absolute inset-0 h-full w-full object-cover"></div>')).toEqual([])
        expect(image('<style>.hero-photo { aspect-ratio: 16 / 9 }</style><img src="x" alt="a" class="hero-photo w-full">')).toEqual([])
    })

    it("flags one that collapses when its picture doesn't load", () => {
        expect(image('<img src="x" alt="a" class="w-full h-auto">')).toHaveLength(1)
        expect(image('<div class="grid grid-cols-2"><img src="x" alt="a" class="h-full w-full object-cover"></div>')).toHaveLength(1)
    })
})

describe("inline SVG", () => {
    it("counts each <svg> once, its own shapes not separately", () => {
        const [issue] = ofKind(check(card('<button><svg viewBox="0 0 10 10"><g><path d="M0 0"/></g><svg><circle r="1"/></svg></svg></button><span><svg><path/></svg></span>')), "inline-svg")
        expect(issue).toMatchObject({ severity: "error", count: 2 })
    })
})

describe("the repair request's list, and the logs", () => {
    it("lists the errors only, the most visible first, one line each", () => {
        const issues = validate(LANDING_FAILING, landing, { mode: "initial", width: 940 })
        const problems = repairProblems(issues)
        expect(problems).toHaveLength(errorCount(issues))
        expect(problems[0]).toMatch(/has no height or aspect ratio/)
        expect(problems[1]).toMatch(/^3 inline <svg>s/)
        expect(problems.slice(2).every((line) => line.startsWith("Banned word"))).toBe(true)
        expect(repairProblems(check(DASHBOARD_REFINE_FAILING, { mode: "refine", previousHtml: DASHBOARD_FAILING })).some((line) => line.includes("Alice Smith"))).toBe(false)
    })

    it("stops at its limit and says how many more there were", () => {
        const many = Array.from({ length: REPAIR_LIST_LIMIT + 3 }, (_, index): Issue => ({ kind: "color", severity: "error", key: `color|${index}`, count: 1, message: `Color ${index}` }))
        const problems = repairProblems(many)
        expect(problems).toHaveLength(REPAIR_LIST_LIMIT + 1)
        expect(problems.at(-1)).toBe("And 3 more problems of the kinds above.")
    })

    it("summarizes by kind for a log line, with none of the page's words in it", () => {
        const summary = issueSummary(check(DASHBOARD_FAILING))
        expect(summary).toEqual({ errors: 3, warnings: 0, kinds: { contrast: 1, placeholder: 1, name: 1 } })
        expect(JSON.stringify(summary)).not.toMatch(/Alice|Completed|Chart/)
    })
})
