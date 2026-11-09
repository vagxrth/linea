import { describe, expect, it } from "vitest"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { BANNED_COPY_WORDS } from "../prompts/design"
import { buildDesignContract } from "./design-contract"
import { BANNED_PATTERNS, errorCount, issueSummary, REPAIR_LIST_LIMIT, repairProblems, validate, type Issue, type ValidationContext } from "./design-validator"
import { DASHBOARD_INITIAL, DASHBOARD_REFINE, DASHBOARD_REPAIRED, LANDING_INITIAL, LANDING_REFINE, SETTINGS_INITIAL } from "./design-validator.fixtures"

const [landingFixture, dashboardFixture, settingsFixture] = EVAL_FIXTURES
const [landing, dashboard, settings] = EVAL_FIXTURES.map((fixture) => buildDesignContract(fixture.guide))

const ofKind = (issues: Issue[], kind: Issue["kind"]) => issues.filter((issue) => issue.kind === kind)
const errors = (issues: Issue[]) => issues.filter((issue) => issue.severity === "error")
// The quoted texts a message names: "Processing" in <td …>
const quoted = (issue: Issue) => [...issue.message.matchAll(/"([^"]+)" in </g)].map((match) => match[1])

// The real dashboard's own <style> block, for small pages in its contract
const DASHBOARD_STYLE = /<style>[\s\S]*?<\/style>/.exec(DASHBOARD_INITIAL)![0]

// A dashboard page with `body` inside its white card
const card = (body: string) => `<div data-generated-ui>${DASHBOARD_STYLE}<div class="c-bg c-fg"><section id="panel" class="c-card-bg c-card-fg p-4">${body}</section></div></div>`

const check = (html: string, context: ValidationContext = { mode: "initial" }) => validate(html, dashboard, context)

describe("the real designs from the live eval on 2026-11-09", () => {
    it("dashboard: the white-on-white status text, at 1.00:1 in 3 places, as one finding", () => {
        const [issue, ...others] = ofKind(check(DASHBOARD_INITIAL), "contrast")
        expect(others).toEqual([])
        expect(issue).toMatchObject({ severity: "error", count: 3, key: "contrast|#FFFFFF|#FFFFFF|4.5" })
        expect(issue.message).toBe(
            'Contrast 1.00:1, under 4.5:1: #FFFFFF text on #FFFFFF (3 places): "Processing" in <td class="px-3 py-2 t-body c-primary-fg"> in [data-node="row-2"]; ' +
            '"Cancelled" in <td class="px-3 py-2 t-body c-destructive-fg"> in [data-node="row-3"]; "Processing" in <td class="px-3 py-2 t-body c-primary-fg"> in [data-node="row-5"]. ' +
            "Use c-card-fg on this c-card-bg, or give the text its own matching pair (c-primary-bg with c-primary-fg)."
        )
    })

    it("dashboard: all five made-up customers, Charlie Brown and Eve Adams included", () => {
        const [issue] = ofKind(check(DASHBOARD_INITIAL), "name")
        expect(issue).toMatchObject({ severity: "error", count: 5 })
        expect(issue.message).toContain('"Alice Smith", "Bob Johnson", "Charlie Brown", "Diana Prince", "Eve Adams"')
    })

    it("dashboard: the chart placeholder and the search icon's SVG too, and nothing else", () => {
        const issues = check(DASHBOARD_INITIAL)
        expect(ofKind(issues, "placeholder").map((issue) => issue.message)).toEqual([
            'Placeholder text "Placeholder for a detailed sales chart." in <p class="t-body c-muted-fg"> in [data-node="chrt01"]. Draw the chart instead: bars built from divs, each a share of the largest, with labels.',
        ])
        expect(ofKind(issues, "inline-svg")).toEqual([expect.objectContaining({ severity: "error", count: 1 })])
        expect(issues.map((issue) => issue.kind)).toEqual(["contrast", "name", "placeholder", "inline-svg"])
    })

    it("dashboard refine: the Delivery Status column beside Status is the one new error", () => {
        const issues = check(DASHBOARD_REFINE, { mode: "refine", previousHtml: DASHBOARD_INITIAL, suppliedText: dashboardFixture.refine })
        expect(errors(issues).map((issue) => issue.message)).toEqual([
            'Table [data-node="tabl01"] has the columns "Status" and "Delivery Status", which say the same thing. Keep one, and drop the other from the header and every row.',
        ])
        // What the page already had stays, as warnings
        expect(issues.filter((issue) => issue.severity === "warning").map((issue) => issue.kind)).toEqual(["contrast", "name", "placeholder", "inline-svg"])
    })

    it("landing: the banned words in its sentences are errors, and one only in a link is a warning", () => {
        const copy = ofKind(validate(LANDING_INITIAL, landing, { mode: "initial", width: 940 }), "copy")
        expect(copy.map((issue) => [issue.key, issue.severity, issue.count])).toEqual([
            ["copy|discover", "warning", 1],
            ["copy|explore", "error", 2],
            ["copy|unique", "error", 1],
            ["copy|perfect", "error", 1],
        ])
        // The error quotes the sentence, where a repair should change it
        expect(copy[1].message).toMatch(/^Banned word "Explore" \(2 places\): "Explore our selection of thoughtfully designed items/)
    })

    it("landing refine: the sage green the request asked for, #E0EAE3, is a warning", () => {
        const issues = validate(LANDING_REFINE, landing, { mode: "refine", previousHtml: LANDING_INITIAL, suppliedText: landingFixture.refine, colorRequested: true, width: 940 })
        expect(ofKind(issues, "color")).toEqual([expect.objectContaining({ key: "color|#E0EAE3", severity: "warning" })])
        expect(errorCount(issues)).toBe(0)
    })

    it("settings: no errors", () => {
        expect(settingsFixture.name).toBe("settings form")
        expect(validate(SETTINGS_INITIAL, settings, { mode: "initial", width: 1200 })).toEqual([])
    })

    it("the dashboard as a good repair leaves it: no issues at all", () => {
        expect(check(DASHBOARD_REPAIRED)).toEqual([])
    })
})

describe("pages that would overflow a recursive walk", () => {
    it("finishes 4,000 <span>s never closed", () => {
        const page = `<div data-generated-ui>${DASHBOARD_STYLE}${'<span class="c-fg">x'.repeat(4000)}</div>`
        expect(() => check(page)).not.toThrow()
    })

    it("finishes nesting 3,000 deep, and still styles the text at the bottom", () => {
        const page = `<div data-generated-ui>${"<div>".repeat(3000)}<p class="bg-white text-white">Deep</p>${"</div>".repeat(3000)}</div>`
        expect(ofKind(check(page), "contrast")).toEqual([expect.objectContaining({ key: "contrast|#FFFFFF|#FFFFFF|4.5" })])
    })

    it("keeps a selector that walks up the page several times fast on a deep one", () => {
        const page = `<div data-generated-ui><style>.a .b .c .d { color: #FFFFFF }</style>${'<div class="a b c d">'.repeat(2000)}<p>Text</p>${"</div>".repeat(2000)}</div>`
        const started = performance.now()
        check(page)
        expect(performance.now() - started).toBeLessThan(5000)
    })
})

describe("contrast", () => {
    it("needs 4.5:1 for normal text and 3:1 for large or bold text", () => {
        // #8A8A8A on white is about 3.45:1
        const page = card('<p style="color: #8A8A8A">Small print</p><p style="color: #8A8A8A; font-size: 24px">Big heading</p><p style="color: #8A8A8A; font-size: 19px; font-weight: 700">Bold line</p>')
        const failing = ofKind(check(page), "contrast")
        expect(failing.map(quoted)).toEqual([["Small print"]])
        expect(failing[0].message).toMatch(/^Contrast 3\.\d\d:1, under 4\.5:1: #8A8A8A text on #FFFFFF: /)
    })

    it("reads Tailwind color classes, inline styles and see-through colors", () => {
        const issues = ofKind(check(card('<span class="text-white">One</span><span style="color: rgba(15, 23, 42, 0.2)">Two</span><span class="bg-slate-900 text-white">Three</span>')), "contrast")
        expect(issues.map(quoted)).toEqual([["One"], ["Two"]])
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

    it("are only warnings for a Tailwind neutral on a border or a divider", () => {
        // (slate-100 would be the contract's own muted color, so stone-100)
        const page = card('<ul class="divide-y divide-stone-100 border border-gray-200"><li class="border-b-zinc-300 md:border-stone-200">A</li></ul>')
        const issues = ofKind(check(page), "color")
        expect(issues).toHaveLength(4)
        expect(issues.every((issue) => issue.severity === "warning")).toBe(true)
        // A neutral that fills a surface isn't a hairline
        expect(ofKind(check(card('<p class="bg-gray-200 border-gray-200">A</p>')), "color")[0].severity).toBe("error")
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

    it("are warnings in a table's headers, a figure's label and a link, and errors in a sentence", () => {
        const severities = (body: string) => ofKind(check(card(body)), "copy").map((issue) => issue.severity)
        expect(severities("<table><thead><tr><th>Unique visitors</th><th>Visits</th></tr></thead></table>")).toEqual(["warning"])
        expect(severities('<article class="p-4"><h3 class="t-label">Unique visitors</h3><p class="t-h1">12,480</p></article>')).toEqual(["warning"])
        expect(severities('<a href="#">Explore the map</a>')).toEqual(["warning"])
        expect(severities("<p>Explore the map to find a shop near you.</p>")).toEqual(["error"])
        // A label beside nothing that's a figure is just a sentence
        expect(severities('<div><h3 class="t-label">Unique visitors</h3><p>Every day</p></div>')).toEqual(["error"])
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

describe("made-up names", () => {
    const named = (text: string) => ofKind(check(card(`<p>${text}</p>`)), "name")[0]?.message ?? null

    it("finds people's names, initials included, and a given name that's also a word when a surname follows", () => {
        expect(named("— Sarah K., plant parent")).toContain('"Sarah K."')
        expect(named("Reviewed by María García-López")).toContain('"María García-López"')
        expect(named('Signed in as <input value="Priya Raman">')).toContain('"Priya Raman"')
        expect(named("Charlie Brown, Eve Adams and Will Smith")).toContain('"Charlie Brown", "Eve Adams", "Will Smith"')
    })

    it("leaves those words alone before an ordinary word, and colors, places and businesses", () => {
        expect(named("Grant Access, Mark Complete, Max Users, May Sale")).toBeNull()
        expect(named("Olive Green, Sage Green, Rose Gold and Ruby Red planters")).toBeNull()
        expect(named("Paris Office, Alice Springs Library, Logan Square, Sarah Lawrence College")).toBeNull()
    })

    it("are warnings in a testimonial or a quote, and errors anywhere else", () => {
        const issues = ofKind(check(card('<blockquote>Lovely pots. <cite>Emma Wilson</cite></blockquote><div class="testimonial-card"><p>Noah Clark</p></div><p>Ordered by Liam Murphy</p>')), "name")
        expect(issues.map((issue) => [issue.key, issue.severity, issue.count])).toEqual([["name", "error", 1], ["name|testimonial", "warning", 2]])
        expect(issues[1].message).toContain('in a testimonial: "Emma Wilson", "Noah Clark"')
    })

    it("leaves a name the user supplied", () => {
        expect(ofKind(check(card("<p>Dr. Maria Lopez</p>"), { mode: "initial", suppliedText: "Dr. Maria Lopez, dentist" }), "name")).toEqual([])
    })
})

describe("placeholders", () => {
    it("finds lorem ipsum, 'goes here' text, example emails, empty chart boxes and canvases", () => {
        const page = card('<p>Lorem ipsum dolor sit amet</p><p>Your logo goes here</p><p>user@example.com</p><div id="sales-chart" class="h-64 c-muted-bg"></div><canvas id="trend"></canvas>')
        expect(ofKind(check(page), "placeholder").map((issue) => issue.key)).toEqual([
            "placeholder|lorem", "placeholder|goes here", "placeholder|user@example.com", 'placeholder|empty|<div id="sales-chart" class="h-64 c-muted-bg">', "placeholder|canvas",
        ])
    })

    it("fixes each the way it fits: copy, a chart or a picture", () => {
        const fix = (body: string) => ofKind(check(card(body)), "placeholder")[0].message.split(". ").slice(1).join(". ")
        expect(fix("<p>Your text goes here</p>")).toBe("Write the real copy, as the copy policy asks.")
        expect(fix("<p>Chart placeholder</p>")).toBe("Draw the chart instead: bars built from divs, each a share of the largest, with labels.")
        expect(fix('<div id="revenue-chart"><p>Coming here: the placeholder</p></div>')).toBe("Draw the chart instead: bars built from divs, each a share of the largest, with labels.")
        expect(fix("<p>Hero image placeholder</p>")).toBe('Show the picture instead: an <img src="placeholder"> in a box with a fixed shape.')
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
        // The landing's real hero, in an aspect-[2.09] box
        expect(ofKind(validate(LANDING_INITIAL, landing, { mode: "initial" }), "image-size")).toEqual([])
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
        const issues = check(DASHBOARD_INITIAL)
        const problems = repairProblems(issues)
        expect(problems).toHaveLength(errorCount(issues))
        expect(problems.map((line) => line.split(" ")[0])).toEqual(["Contrast", "1", "Placeholder", "Made-up"])
        // A refine's list leaves out what the page already had
        expect(repairProblems(check(DASHBOARD_REFINE, { mode: "refine", previousHtml: DASHBOARD_INITIAL })).some((line) => line.includes("Alice Smith"))).toBe(false)
    })

    it("stops at its limit and says how many more there were", () => {
        const many = Array.from({ length: REPAIR_LIST_LIMIT + 3 }, (_, index): Issue => ({ kind: "color", severity: "error", key: `color|${index}`, count: 1, message: `Color ${index}` }))
        const problems = repairProblems(many)
        expect(problems).toHaveLength(REPAIR_LIST_LIMIT + 1)
        expect(problems.at(-1)).toBe("And 3 more problems of the kinds above.")
    })

    it("summarizes by kind for a log line, with none of the page's words in it", () => {
        const summary = issueSummary(check(DASHBOARD_INITIAL))
        expect(summary).toEqual({ errors: 4, warnings: 0, kinds: { contrast: 1, "inline-svg": 1, placeholder: 1, name: 1 } })
        expect(JSON.stringify(summary)).not.toMatch(/Alice|Processing|Placeholder for/)
    })
})
