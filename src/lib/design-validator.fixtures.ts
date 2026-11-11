import { readFileSync } from "node:fs"

// The designs the live eval on ed09207 wrote on 2026-11-09, as they came back from gemini-2.5-flash
// for the eval's fixtures (scripts/eval-fixtures.ts), images resolved. They're the validator's test
// pages: what's known to be wrong with each is checked in design-validator.test.ts.
const real = (name: string) => readFileSync(new URL(`./__fixtures__/eval-2026-11-09/${name}.html`, import.meta.url), "utf8")

// White-on-white status text (3 places), five made-up customers, a chart placeholder, a search icon in SVG
export const DASHBOARD_INITIAL = real("dense-dashboard-initial")
// "Make the table rows more compact and add a status column": a Delivery Status column beside Status
export const DASHBOARD_REFINE = real("dense-dashboard-refine")
// Banned words: explore, unique and perfect in its sentences, discover and explore in its links
export const LANDING_INITIAL = real("landing-initial")
// "Give the hero section a soft sage green background…": #E0EAE3, a color the request asked for
export const LANDING_REFINE = real("landing-refine")
// Nothing the check calls an error
export const SETTINGS_INITIAL = real("settings-form-initial")

// Applies each change to a page, and fails loudly if what it changes isn't there any more
const edited = (html: string, changes: [from: string | RegExp, to: string][]) =>
    changes.reduce((page, [from, to]) => {
        const next = typeof from === "string" ? page.split(from).join(to) : page.replace(from, to)
        if (next === page) throw new Error(`The fixture no longer has ${String(from)}`)
        return next
    }, html)

const bar = (day: string, height: number) =>
    `<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end"><div class="chart-bar w-full rounded-t c-primary-bg" style="height: ${height}%"></div><span class="t-small c-muted-fg">${day}</span></div>`

// The real dashboard as a good repair would leave it: the status text on its own pairs, the customers
// by role, the chart drawn from divs and the search icon as a symbol. Every id and data-node stays.
export const DASHBOARD_REPAIRED = edited(DASHBOARD_INITIAL, [
    ['<td class="px-3 py-2 t-body c-primary-fg">Processing</td>', '<td class="px-3 py-2 t-body"><span class="rounded-full px-2 py-0.5 t-small c-primary-bg c-primary-fg">Processing</span></td>'],
    ['<td class="px-3 py-2 t-body c-destructive-fg">Cancelled</td>', '<td class="px-3 py-2 t-body"><span class="rounded-full px-2 py-0.5 t-small c-destructive-bg c-destructive-fg">Cancelled</span></td>'],
    ["Alice Smith", "Retail customer"],
    ["Bob Johnson", "Wholesale account"],
    ["Charlie Brown", "Retail customer"],
    ["Diana Prince", "Café account"],
    ["Eve Adams", "Retail customer"],
    ['<p class="t-body c-muted-fg">Placeholder for a detailed sales chart.</p>', `<div class="flex items-end gap-3 h-48 w-full">${bar("Mon", 45)}${bar("Tue", 62)}${bar("Wed", 54)}${bar("Thu", 80)}${bar("Fri", 100)}</div>`],
    [/<svg[\s\S]*?<\/svg>/, '<span aria-hidden="true">⌕</span>'],
])

// Run 2 of the live eval, on 027f276 (2026-11-09), as it came back: the kept designs, and as .first the
// ones the check repaired
const run2 = (name: string) => readFileSync(new URL(`./__fixtures__/eval-2026-11-09b/${name}.html`, import.meta.url), "utf8")

// The chart's bars at 66%, 80%… of columns with no set height, so 0px tall; customers as "Customer 1…5"
export const RUN2_DASHBOARD_INITIAL = run2("dense-dashboard-initial")
export const RUN2_DASHBOARD_REFINE = run2("dense-dashboard-refine")
export const RUN2_LANDING_INITIAL = run2("landing-initial")
export const RUN2_LANDING_REFINE = run2("landing-refine")
// value="Your Name" and your.email@example.com, left after its repair
export const RUN2_SETTINGS_INITIAL = run2("settings-form-initial")
export const RUN2_SETTINGS_REFINE = run2("settings-form-refine")
