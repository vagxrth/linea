import { BANNED_COPY_WORDS } from "../prompts/design"
import { COLOR_ROLES, CONTRAST_PAIRS, LARGE_TEXT_CONTRAST, NORMAL_TEXT_CONTRAST, contrastRatio, type ColorRole, type DesignContract } from "./design-contract"
import { colorsIn, toHex, type Rgba } from "./design-colors"
import { computeStyles, drawnColors, parseDeclarations, parseStylesheet, splitOutside, utility, type ComputedStyle } from "./design-styles"
import { clipText, describeElement, elementChildren, elementsOf, isWithin, nearestLandmark, ownText, parseHtml, textContent, ROOT, type HtmlElement } from "./html-tree"

// Checks a finished design for what a reader would call broken, without judging taste: text that
// can't be read, colors from outside the design contract, copy the copy policy rules out, made-up
// people and placeholder text, a table column twice, images that collapse when they don't load, and
// inline SVG, which the design's frame removes. Pure: the same HTML, contract and context always give
// the same issues. An error is worth one repair call (src/lib/design-generation.ts); a warning is
// only reported.

export type IssueKind = "contrast" | "color" | "copy" | "name" | "placeholder" | "duplicate-column" | "image-size" | "collapsed-height" | "inline-svg"

export type Issue = {
    kind: IssueKind
    severity: "error" | "warning"
    // What's wrong, where, and what fixes it, in one line: the repair request lists these as they are
    message: string
    // The same problem in another version of the page has the same key
    key: string
    // How many places it's in
    count: number
    // Words for the parts of the page it's in (its section's heading, ids and data-nodes, and what kind
    // of element it is), for telling whether a refine's request touches it
    regions?: string[]
}

export type ValidationContext = {
    mode?: "initial" | "refine" | "workflow"
    // Words the user supplied (the wireframe's copy, their request): the copy rules don't overrule them
    suppliedText?: string
    // The page this one was made from: a refine's current page, a workflow page's main page. A problem
    // it already had is a warning here, not an error, since a change shouldn't fix what nobody asked about.
    previousHtml?: string
    // A refine that asks for a color, which may be one the contract doesn't have
    colorRequested?: boolean
    // The frame's width in px, for media queries and sm:/md: classes
    width?: number
    // A refine's request: a problem the page already had stays an error when the request touches its part
    request?: string
}

export const DEFAULT_FRAME_WIDTH = 1280

// Where page text doesn't show, or isn't the page's copy
const NOT_COPY = new Set(["style", "script", "template", "noscript", "svg", "math", "title"])

// --- Reading the page --------------------------------------------------------------------------

type Page = {
    root: HtmlElement
    all: HtmlElement[]
    styles: Map<HtmlElement, ComputedStyle>
    sheet: ReturnType<typeof parseStylesheet>
    width: number
}

const readPage = (html: string, width: number): Page => {
    const root = parseHtml(html)
    const all = elementsOf(root)
    const css = all
        .filter((node) => node.tag === "style")
        .map((node) => node.children.map((child) => (child.kind === "text" ? child.text : "")).join(""))
        .join("\n")
    const sheet = parseStylesheet(css, width)
    return { root, all, styles: computeStyles(root, sheet, width), sheet, width }
}

// Where an element is, for a message: <td class="t-body c-primary-fg"> in [data-node="row-2"]
const where = (node: HtmlElement) => {
    const around = nearestLandmark(node.parent)
    return `${describeElement(node)}${around ? ` in ${around}` : ""}`
}

const places = (count: number) => (count > 1 ? ` (${count} places)` : "")

const quote = (text: string) => `"${clipText(text, 60)}"`

// --- Regions: which part of the page an issue is in ------------------------------------------------

// What a request would call an element of each kind
const TAG_WORDS: Record<string, string[]> = {
    table: ["table", "row", "column", "cell"], thead: ["table", "header", "column"], tbody: ["table", "row"], tr: ["table", "row"], td: ["table", "row", "cell", "column"], th: ["table", "column", "header"],
    nav: ["nav", "navigation", "menu", "link"], aside: ["sidebar", "side", "panel"], header: ["header", "top", "bar"], footer: ["footer", "bottom"],
    form: ["form", "field", "input"], input: ["form", "field", "input"], select: ["form", "field"], textarea: ["form", "field"], label: ["form", "field", "label"],
    button: ["button"], img: ["image", "photo", "picture"], h1: ["headline", "heading", "title"], blockquote: ["quote", "testimonial"],
}
// A table's part of the page is the section around it, with that section's heading
const SECTION_TAGS = new Set(["section", "article", "aside", "header", "nav", "footer", "form"])
// The outline's short ids for components, as a request would name them
const NODE_WORDS: Record<string, string> = { chrt: "chart", tabl: "table", srch: "search", btn: "button", kpi: "stat", img: "image", avat: "avatar", side: "sidebar", head: "header", tgl: "toggle", inp: "input", lbl: "label" }
// Words too general to say which part of a page is meant
const GENERAL_WORDS = new Set(["section", "page", "part", "area", "block", "container", "wrapper", "content", "main", "item", "text", "the", "and", "for", "with"])

const wordsOf = (text: string) =>
    text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 3).map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word)).filter((word) => !GENERAL_WORDS.has(word))

// The part of the page around an element, as words: its own kind and its ancestors', their ids, and
// the nearest section's heading and the data-nodes in it (hero01 is "hero")
const regionWords = (node: HtmlElement) => {
    const words = new Set<string>()
    let section: HtmlElement | null = null
    for (let at: HtmlElement | null = node; at && at.tag !== ROOT; at = at.parent) {
        for (const word of TAG_WORDS[at.tag] ?? []) words.add(word)
        for (const word of wordsOf(at.attributes.get("id") ?? "")) words.add(word)
        if (!section && SECTION_TAGS.has(at.tag)) section = at
    }
    if (section) {
        for (const inner of elementsOf(section)) {
            for (const word of wordsOf((inner.attributes.get("data-node") ?? "").replace(/\d+/g, " "))) words.add(NODE_WORDS[word] ?? word)
            if (/^h[1-3]$/.test(inner.tag)) for (const word of wordsOf(textContent(inner))) words.add(word)
        }
    }
    return words
}

const regionsOf = (nodes: HtmlElement[]) => [...new Set(nodes.flatMap((node) => [...regionWords(node)]))].sort()

// Whether a refine's request names the part of the page an issue is in
export const touchedBy = (issue: Issue, request: string) => {
    const asked = new Set(wordsOf(request))
    return (issue.regions ?? []).some((word) => asked.has(word))
}

// --- Contrast ----------------------------------------------------------------------------------

const BACKGROUND_CLASS: Partial<Record<ColorRole, string>> = {
    background: "c-bg", card: "c-card-bg", popover: "c-popover-bg", primary: "c-primary-bg", secondary: "c-secondary-bg",
    muted: "c-muted-bg", accent: "c-accent-bg", destructive: "c-destructive-bg",
}
const TEXT_CLASS: Partial<Record<ColorRole, string>> = {
    foreground: "c-fg", cardForeground: "c-card-fg", popoverForeground: "c-popover-fg", primaryForeground: "c-primary-fg",
    secondaryForeground: "c-secondary-fg", mutedForeground: "c-muted-fg", accentForeground: "c-accent-fg", destructiveForeground: "c-destructive-fg",
}

// What to use on a surface: its own text class when the surface is one of the contract's
const contrastFix = (surface: string, contract: DesignContract) => {
    const role = COLOR_ROLES.find((name) => BACKGROUND_CLASS[name] && contract.colors[name].toUpperCase() === surface)
    const pair = role ? CONTRAST_PAIRS.find(([background]) => background === role) : null
    if (role && pair && TEXT_CLASS[pair[1]]) return `Use ${TEXT_CLASS[pair[1]]} on this ${BACKGROUND_CLASS[role]}, or give the text its own matching pair (c-primary-bg with c-primary-fg).`
    return "Give the text and its surface a matching .c-* pair (c-primary-bg with c-primary-fg, c-card-bg with c-card-fg)."
}

const isDisabled = (node: HtmlElement) => {
    for (let at: HtmlElement | null = node; at; at = at.parent) {
        if (at.attributes.has("disabled") || at.attributes.get("aria-disabled") === "true") return true
    }
    return false
}

// One issue for each pair of colors that fails, with up to three of the places it's in
const contrastIssues = (page: Page, contract: DesignContract): Issue[] => {
    const groups = new Map<string, { fg: string; bg: string; ratio: number; needed: number; count: number; samples: Map<string, string>; nodes: HtmlElement[] }>()
    for (const node of page.all) {
        const text = ownText(node)
        if (!/[\p{L}\p{N}]/u.test(text) || isWithin(node, NOT_COPY) || node.tag === "option" || node.tag === "textarea") continue
        const style = page.styles.get(node)!
        if (style.hidden || isDisabled(node)) continue
        const drawn = drawnColors(node, page.styles)
        if (!drawn) continue
        const [fg, bg] = [toHex(drawn.text), toHex(drawn.surface)]
        const ratio = contrastRatio(fg, bg)
        const large = style.fontSize >= 24 || (style.fontSize >= 18.66 && style.fontWeight >= 700)
        const needed = large ? LARGE_TEXT_CONTRAST : NORMAL_TEXT_CONTRAST
        if (ratio >= needed) continue
        const key = `contrast|${fg}|${bg}|${needed}`
        const group = groups.get(key) ?? { fg, bg, ratio, needed, count: 0, samples: new Map<string, string>(), nodes: [] }
        group.count++
        group.nodes.push(node)
        const spot = where(node)
        if (group.samples.size < 3 && !group.samples.has(spot)) group.samples.set(spot, text)
        groups.set(key, group)
    }
    return [...groups.entries()].map(([key, group]) => ({
        kind: "contrast",
        severity: "error",
        key,
        count: group.count,
        regions: regionsOf(group.nodes),
        message: `Contrast ${group.ratio.toFixed(2)}:1, under ${group.needed}:1: ${group.fg} text on ${group.bg}${places(group.count)}: ${[...group.samples].map(([spot, text]) => `${quote(text)} in ${spot}`).join("; ")}. ${contrastFix(group.bg, contract)}`,
    }))
}

// --- Colors outside the contract ---------------------------------------------------------------

// Properties that paint a color. Shadows and filters don't count: a soft black shadow isn't a palette color.
const PAINTS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|text-decoration(-color)?|column-rule(-color)?|caret-color|accent-color|fill|stroke|stop-color|flood-color|--.+)$/

// States the design's frame never shows: it's inert, so nothing in it is hovered, focused or pressed
const STATE_SELECTOR = /:(?:hover|focus|focus-visible|focus-within|active|visited|checked|disabled)\b/i
const isStateClass = (name: string) =>
    splitOutside(name, ":").slice(0, -1).some((variant) => /^(?:hover|focus|focus-visible|focus-within|active|visited|checked|disabled|group-|peer-)/.test(variant))

// A Tailwind neutral on a border or a divider (border-gray-200, divide-slate-100): a hairline the
// contract's border color would do better, but not worth a repair
const NEUTRAL_LINE = /^(?:border(?:-[xytrblse])?|divide)-(?:gray|zinc|neutral|slate|stone)-\d{2,3}(?:\/.+)?$/
const isNeutralLine = (name: string) => NEUTRAL_LINE.test((splitOutside(name, ":").pop() ?? "").replace(/^!|!$/g, ""))

const colorIssues = (page: Page, contract: DesignContract, context: ValidationContext): Issue[] => {
    const palette = new Set(Object.values(contract.colors).map((hex) => hex.toUpperCase()))
    // Each color's places, and whether every one is minor: a state the frame never shows, or a neutral hairline
    const found = new Map<string, { spots: Map<string, number>; allMinor: boolean }>()
    const add = (color: Rgba, place: string, minor: boolean) => {
        if (color.a === 0) return
        const hex = toHex(color)
        // Any shade of the contract's colors is the contract's color, and see-through black or white is a
        // scrim, a hairline or a shadow rather than a palette color
        if (palette.has(hex) || (color.a < 1 && (hex === "#000000" || hex === "#FFFFFF"))) return
        const entry = found.get(hex) ?? { spots: new Map<string, number>(), allMinor: true }
        entry.spots.set(place, (entry.spots.get(place) ?? 0) + 1)
        entry.allMinor &&= minor
        found.set(hex, entry)
    }
    for (const declaration of page.sheet.written) {
        if (!PAINTS.test(declaration.property)) continue
        for (const { color } of colorsIn(declaration.value)) add(color, `${clipText(declaration.selector, 40)} { ${declaration.property} }`, STATE_SELECTOR.test(declaration.selector))
    }
    for (const node of page.all) {
        if (node.tag === ROOT || isWithin(node, new Set(["svg", "math"]))) continue
        for (const declaration of parseDeclarations(node.attributes.get("style") ?? "")) {
            if (!PAINTS.test(declaration.property)) continue
            for (const { color } of colorsIn(declaration.value)) add(color, `style="${declaration.property}: …" on ${describeElement(node)}`, false)
        }
        for (const name of node.classes) {
            for (const painted of utility(name, page.width).colors) add(painted.color, painted.theme ? `${name} (Linea's own theme color)` : name, isStateClass(name) || isNeutralLine(name))
        }
    }
    return [...found.entries()].map(([hex, { spots, allMinor }]) => {
        const count = [...spots.values()].reduce((sum, value) => sum + value, 0)
        const list = [...spots.entries()].slice(0, 3).map(([place, times]) => (times > 1 ? `${place} ×${times}` : place))
        // Off the contract all the same, but a hover color no one sees in the frame, or a gray hairline,
        // isn't worth a repair
        const warning = allMinor || (context.mode === "refine" && context.colorRequested)
        return {
            kind: "color",
            severity: warning ? "warning" : "error",
            key: `color|${hex}`,
            count,
            message: `Color ${hex} isn't in the design contract: ${list.join(", ")}${spots.size > 3 ? ` and ${spots.size - 3} more` : ""}. Use the contract's colors, through the .c-* classes.`,
        } satisfies Issue
    })
}

// --- Copy --------------------------------------------------------------------------------------

// A piece of the page's copy and the element it's in: text, and what form fields show
type Copy = { text: string; node: HtmlElement }

const copyOf = (page: Page): Copy[] => {
    const copy: Copy[] = []
    for (const node of page.all) {
        if (isWithin(node, NOT_COPY)) continue
        const text = ownText(node)
        if (text) copy.push({ text, node })
        if (node.tag === "input" || node.tag === "textarea") {
            const type = (node.attributes.get("type") ?? "text").toLowerCase()
            if (type === "hidden" || type === "password") continue
            for (const attribute of ["value", "placeholder"]) {
                const value = node.attributes.get(attribute)
                if (value) copy.push({ text: value, node })
            }
        }
    }
    return copy
}

// A banned word and the forms of it the policy means: "explore" is explored and exploring too, and
// "transform (in any form)" is transformation and transformative
const bannedPattern = (entry: string): RegExp => {
    const word = entry.replace(/\s*\(.*\)$/, "").toLowerCase()
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    let body: string
    if (/\(in any form\)/.test(entry)) body = `${escape(word)}\\w*`
    else if (word.includes(" ")) body = `${escape(word)}s?`
    else if (word.includes("-")) body = escape(word).replace(/\\?-/g, "[- ]")
    else if (word.endsWith("ated")) body = `${escape(word.slice(0, -2))}(?:e|es|ed|ing|ion|ions)`
    else if (word.endsWith("e")) body = `${escape(word.slice(0, -1))}(?:e|es|ed|ing|ely|eness)`
    else if (word.endsWith("ry")) body = `${escape(word.slice(0, -1))}(?:y|ies)`
    else if (word.endsWith("is")) body = `${escape(word.slice(0, -2))}(?:is|es)`
    else body = `${escape(word)}(?:s|es|ed|ing|ly|ness)?`
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu")
}

export const BANNED_PATTERNS = BANNED_COPY_WORDS.map((entry) => ({ word: entry.replace(/\s*\(.*\)$/, ""), pattern: bannedPattern(entry) }))

// Copy that names a thing rather than says something: a link, a table's column, a figure's label. A
// banned word there ("Explore the map", "Unique visitors") is reported, but isn't worth a repair.
const LABEL_TAGS = new Set(["a", "th", "thead", "dt"])

// A figure as a stat card shows it: 1,234, $45,231, +12%, 8.2k
const FIGURE = /^[+\-−]?[$€£¥]?\d[\d,.]*\s?(?:%|[kmb]|ms|s)?$/i

// A short label in a small box with a figure in it: a stat card's label and value
const isMetricLabel = (node: HtmlElement, text: string) => {
    if (text.split(/\s+/).length > 5 || /[.!?]$/.test(text)) return false
    for (const box of [node.parent, node.parent?.parent]) {
        if (!box || box.tag === ROOT) continue
        const inside = elementsOf(box)
        if (inside.length <= 12 && inside.some((other) => other !== node && FIGURE.test(ownText(other)))) return true
    }
    return false
}

const isLabelCopy = (item: Copy) => isWithin(item.node, LABEL_TAGS) || isMetricLabel(item.node, item.text)

const copyIssues = (copy: Copy[], context: ValidationContext): Issue[] => {
    const issues: Issue[] = []
    for (const { word, pattern } of BANNED_PATTERNS) {
        // A word the user wrote themselves stays
        if (context.suppliedText && new RegExp(pattern.source, "iu").test(context.suppliedText)) continue
        const hits: { form: string; item: Copy }[] = []
        for (const item of copy) {
            for (const match of item.text.matchAll(pattern)) hits.push({ form: match[0], item })
        }
        if (hits.length === 0) continue
        // An error once it's in the page's sentences; only in its labels, a warning
        const prose = hits.find((hit) => !isLabelCopy(hit.item))
        const shown = prose ?? hits[0]
        issues.push({
            kind: "copy",
            severity: prose ? "error" : "warning",
            key: `copy|${word}`,
            count: hits.length,
            regions: regionsOf(hits.map((hit) => hit.item.node)),
            message: `Banned word ${quote(shown.form)}${places(hits.length)}: ${quote(shown.item.text)} in ${where(shown.item.node)}. Say it plainly instead, as the copy policy asks.`,
        })
    }
    return issues
}

// Common given names: with any capitalized word after them, a person ("Sarah Chen")
const FIRST_NAMES = new Set(`
    aaron adam adrian adriana ahmed aisha alan albert alejandra alejandro alex alexander alexandra ali alice alicia amanda amelia amy ana
    ananya andre andrea andrew andy angela anna anne anthony antonio anya aria arjun arthur ashley astrid audrey ava barbara beatriz ben
    benjamin beth betty bob brandon brenda brian brittany bruce bryan camila carl carla carlos carmen carol caroline catherine charles
    charlotte chiara chloe chris christina christine christopher claire clara colin connor cynthia dan daniel daniela danielle david
    deborah debra denise dennis derek diana diane diego dmitri dominic donald donna doris dorothy douglas dylan edward elena eli elijah
    elizabeth ella ellie emilia emily emma eric ethan eugene evan evelyn fatima felix fernanda fernando francis francisco freya
    gabriel gabriela gary george gerald giulia gloria greg gregory greta hannah hans harold harper harry harvey haruka heidi helen henry
    hiroshi hugo ian ines ingrid irina isaac isabel isabella ivan jacob jacqueline jake james jane janet janice jason javier jeff jeffrey
    jennifer jeremy jesse jessica jim joan joanna joe joel john jon jonathan jorge jose joseph josh joshua juan judith julia julian julie
    justin kai karen karl katherine kathleen kathryn kayla keiko keith kelly kenji kenneth kevin kimberly kristen kyle lars laura lauren
    lawrence layla leah leila leo leon liam linda lisa logan lorenzo louis luca lucas lucia lucy luis luke madison malik manuel marco
    marcus margaret maria mariana marie mario marilyn martha martin mary mateo matt matthew maya megan mei melissa mia michael
    michelle miguel mike milo mohammed monica muhammad nancy natalie natasha nathan nicholas nick nicole nina noah noor nora olga olivia
    omar oscar owen pablo pamela patricia patrick paul paula pedro pete peter philip priya rachel rafael rahul raj ralph ramon randy
    raymond rebecca ricardo richard rita rob robert roberto roger ronald russell ruth ryan sam samantha samuel sandra sara sarah scott
    sean sebastian sergio sharon shirley simon sofia sophia sophie stefan stephanie stephen steve steven susan svetlana sven tatiana
    ted teresa theo theresa thomas tim timothy tom tony tyler valentina vanessa veronica victor vincent walter wayne wendy william
    xavier yara yuki yusuf zachary zara zoe
`.trim().split(/\s+/))

// Given names that are also ordinary words or colors (Charlie, Eve, Will, Mark, Grace, Rose): a person
// only with a surname after them ("Charlie Brown", "Eve Adams"), never on their own or before an
// ordinary word ("Grant Access", "Mark Complete", "Max Users")
const WORD_FIRST_NAMES = new Set(`
    charlie eve will mark grace may june april august rose lily ivy jade ruby amber hazel olive sage dawn joy faith hope summer autumn
    max jack bill frank ray dean miles grant chase hunter austin jordan guy art don pat rich gene sue terry penny sandy crystal holly
    heather violet iris daisy pearl angel christian river sky page carter morgan taylor drew reed wade earl victoria virginia georgia
    florence sydney paris dallas
`.trim().split(/\s+/))

// Common surnames, for the given names that are also words
const SURNAMES = new Set(`
    smith johnson williams brown jones garcia miller davis rodriguez martinez hernandez lopez gonzalez wilson anderson thomas taylor
    moore jackson martin lee perez thompson white harris sanchez clark ramirez lewis robinson walker young allen king wright scott torres
    nguyen hill flores green adams nelson baker hall rivera campbell mitchell carter roberts gomez phillips evans turner diaz parker cruz
    edwards collins reyes stewart morris morales murphy cook rogers gutierrez ortiz morgan cooper peterson bailey reed kelly howard ramos
    kim cox ward richardson watson brooks chavez wood james bennett gray grey mendoza ruiz hughes price alvarez castillo sanders patel
    myers long ross foster jimenez powell jenkins perry russell sullivan bell coleman butler henderson barnes fisher vasquez simmons
    romero jordan patterson alexander hamilton graham reynolds griffin wallace moreno west cole hayes bryant herrera gibson ellis tran
    medina aguilar stevens murray ford castro marshall owens harrison fernandez mcdonald woods washington kennedy wells vargas henry chen
    freeman webb tucker guzman burns crawford olson simpson porter hunter gordon mendez silva shaw snyder mason dixon munoz hunt hicks
    holmes palmer wagner black robertson boyd rose stone salazar fox warren mills meyer rice schmidt garza daniels ferguson nichols
    stephens soto weaver ryan gardner payne grant dunn kelley spencer hawkins arnold pierce hansen peters santos hart bradley knight
    elliott cunningham duncan armstrong hudson carroll lane riley andrews berry perkins hoffman johnston matthews richards willis
    carpenter lawrence chapman watkins greene wheeler harper burke larson morrison franklin carlson austin lawson jacobs obrien o'brien
    oconnor o'connor lynch singh bishop montgomery oliver jensen harvey williamson gilbert dean wong reid hanson li wang zhang liu yang
    huang zhao wu zhou xu park choi jung kang cho yoon tanaka sato suzuki takahashi watanabe ito yamamoto nakamura kobayashi kumar sharma
    gupta shah mehta khan ahmed ali hassan hussain ibrahim rahman mueller muller schneider becker hoffmann schulz koch richter wolf
    schroeder rossi russo ferrari esposito bianchi romano colombo ricci marino greco bruno conti costa dubois bernard petit durand leroy
    moreau laurent michel oliveira souza pereira ferreira almeida carvalho gomes ribeiro novak kowalski nowak ivanov petrov nielsen
    andersen larsen johansson karlsson nilsson eriksson berg walsh byrne doyle brennan quinn fitzgerald prince doe
`.trim().split(/\s+/))

// Olive Green, Sage Green, Rose Gold, Ruby Red, Sky Blue: colors, not people
const COLOR_NAMES = new Set(["olive", "sage", "ruby", "rose", "ivy", "jade", "amber", "hazel", "violet", "sky", "hunter", "iris", "daisy", "pearl"])
const COLOR_WORDS = new Set(["green", "gold", "red", "blue", "brown", "white", "black", "gray", "grey", "pink", "purple", "silver"])

// Words after a given name that make it a place or a business, not a person
const NOT_SURNAMES = new Set(["street", "avenue", "road", "lane", "park", "square", "hall", "center", "centre", "university", "college", "school", "hospital", "clinic", "bank", "group", "inc", "ltd", "llc", "studio", "studios", "labs", "cafe", "café", "hotel", "gardens", "garden", "plaza", "tower", "station", "airport", "beach", "lake", "market", "foundation", "institute", "museum", "library", "collection", "plan", "pro", "plus", "office", "offices", "store", "shop", "headquarters", "branch", "campus", "chair", "sofa", "lamp", "table", "bowl", "jar"])

// "Alice Smith", "María García-López", "Sarah K."
const PERSON = /(?<![\p{L}])(\p{Lu}\p{Ll}+)\s+(\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}\p{Ll}+)?|\p{Lu}\.)(?![\p{L}])/gu

// María is maria to the lists
const plain = (word: string) => word.normalize("NFD").replace(/\p{M}/gu, "").replace(/’/g, "'").toLowerCase()

const isPerson = (first: string, last: string) => {
    const [given, family] = [plain(first), plain(last)]
    if (NOT_SURNAMES.has(family)) return false
    if (FIRST_NAMES.has(given)) return true
    if (!WORD_FIRST_NAMES.has(given) || (COLOR_NAMES.has(given) && COLOR_WORDS.has(family))) return false
    return family.split("-").some((part) => SURNAMES.has(part))
}

// A quote and who said it: a testimonial, which the copy policy rules out too, but its name is a
// warning, not a repair
const QUOTE_TAGS = new Set(["blockquote", "q", "cite", "figcaption"])
const inTestimonial = (node: HtmlElement) => {
    for (let at: HtmlElement | null = node; at; at = at.parent) {
        if (QUOTE_TAGS.has(at.tag)) return true
        if ([at.attributes.get("id") ?? "", ...at.classes].some((name) => /testimonial|quote|review/i.test(name))) return true
    }
    return false
}

const nameIssues = (copy: Copy[], context: ValidationContext): Issue[] => {
    const supplied = (context.suppliedText ?? "").toLowerCase()
    const prose = new Map<string, Copy>()
    const quotes = new Map<string, Copy>()
    for (const item of copy) {
        for (const match of item.text.matchAll(PERSON)) {
            const [whole, first, last] = match
            // "Sarah Lawrence College" is a place, by the word after the name as much as in it
            const next = /^\s+(\p{L}+)/u.exec(item.text.slice((match.index ?? 0) + whole.length))?.[1]?.toLowerCase()
            if (!isPerson(first, last) || (next && NOT_SURNAMES.has(next))) continue
            if (supplied.includes(whole.toLowerCase()) || prose.has(whole) || quotes.has(whole)) continue
            ;(inTestimonial(item.node) ? quotes : prose).set(whole, item)
        }
    }
    const issue = (names: Map<string, Copy>, testimonial: boolean): Issue[] => {
        if (names.size === 0) return []
        const listed = [...names.keys()].slice(0, 5).map((name) => `"${name}"`)
        const spots = [...new Set([...names.values()].map((item) => nearestLandmark(item.node) ?? describeElement(item.node)))].slice(0, 3)
        return [{
            kind: "name",
            severity: testimonial ? "warning" : "error",
            key: testimonial ? "name|testimonial" : "name",
            count: names.size,
            regions: regionsOf([...names.values()].map((item) => item.node)),
            message: `Made-up people's names${testimonial ? " in a testimonial" : ""}: ${listed.join(", ")}${names.size > 5 ? ` and ${names.size - 5} more` : ""} (in ${spots.join(", ")}). Use realistic company names (Northwind Traders) or roles instead, as the copy policy asks.`,
        }]
    }
    return [...issue(prose, false), ...issue(quotes, true)]
}

// --- Placeholders ------------------------------------------------------------------------------

// The box a chart was meant to fill, by its id or class: revenue-chart, chart, chart-area (not chart-bar)
const CHART_BOX = /^(?:[\w-]*-)?(?:chart|graph)(?:-(?:area|container|wrapper|placeholder|box|canvas|panel))?$/i

const COPY_FIX = "Write the real copy, as the copy policy asks."
const CHART_FIX = "Draw the chart instead: bars built from divs, each a share of the largest, with labels."
const IMAGE_FIX = 'Show the picture instead: an <img src="placeholder"> in a box with a fixed shape.'

// What a placeholder stood for decides its fix: a chart, a picture, or copy ("Your text goes here")
const placeholderFix = (item: Copy) => {
    const inChartBox = (() => {
        for (let at: HtmlElement | null = item.node; at; at = at.parent) {
            if ([at.attributes.get("id") ?? "", ...at.classes].some((name) => CHART_BOX.test(name))) return true
        }
        return false
    })()
    if (inChartBox || /\b(?:chart|graph|plot|trend|visuali[sz]ation)s?\b/i.test(item.text)) return CHART_FIX
    if (/\b(?:image|photo|picture|illustration)s?\b/i.test(item.text)) return IMAGE_FIX
    return COPY_FIX
}

const PLACEHOLDER_TEXT: { pattern: RegExp; fix: (item: Copy) => string }[] = [
    { pattern: /\blorem\b|\bipsum\b|\bdolor sit amet\b/i, fix: () => COPY_FIX },
    { pattern: /\bplaceholder\b|\b(?:goes|go|will go|will appear|will be shown) here\b/i, fix: placeholderFix },
    { pattern: /\[[^\]]*\b(?:insert|your|name|company|logo|image|chart|title|text|here|placeholder)\b[^\]]*\]/i, fix: () => COPY_FIX },
    { pattern: /\b(?:john|jane) doe\b|[\w.+-]+@example\.(?:com|org|net)\b|^your (?:full |first |last )?(?:name|e-?mail(?: address)?|company|business|phone(?: number)?|title|address)$/i, fix: () => SAMPLE_FIX },
]

const SAMPLE_FIX = "Use a realistic sample value: an address at the brand's own domain (hello@terrabloom.co), a business or team name where a name goes, as the copy policy asks."

// "Customer 1", "Customer 2": a list numbered instead of filled in
const NUMBERED = /^(customer|user|item|client|product|project)\s*#?\s*(\d+)$/i

const placeholderIssues = (page: Page, copy: Copy[], context: ValidationContext): Issue[] => {
    const supplied = context.suppliedText ?? ""
    const groups = new Map<string, { message: string; count: number; nodes: HtmlElement[]; severity: Issue["severity"] }>()
    const add = (key: string, message: string, node: HtmlElement, severity: Issue["severity"] = "error") => {
        const group = groups.get(key) ?? { message, count: 0, nodes: [], severity }
        group.count++
        group.nodes.push(node)
        groups.set(key, group)
    }
    for (const item of copy) {
        for (const { pattern, fix } of PLACEHOLDER_TEXT) {
            const match = pattern.exec(item.text)
            if (!match || pattern.test(supplied)) continue
            add(`placeholder|${match[0].toLowerCase()}`, `Placeholder text ${quote(item.text)} in ${where(item.node)}. ${fix(item)}`, item.node)
            break
        }
    }
    // A numbered sequence is a warning: the page works, it just reads as unfinished
    const numbered = new Map<string, Copy[]>()
    for (const item of copy) {
        const match = NUMBERED.exec(item.text.trim())
        if (match) numbered.set(match[1].toLowerCase(), [...(numbered.get(match[1].toLowerCase()) ?? []), item])
    }
    for (const [word, items] of numbered) {
        if (new Set(items.map((item) => item.text.trim().toLowerCase())).size < 2) continue
        const listed = items.slice(0, 3).map((item) => `"${item.text.trim()}"`).join(", ")
        for (const item of items) {
            add(`placeholder|numbered|${word}`, `Numbered stand-ins ${listed}${items.length > 3 ? "…" : ""} in ${nearestLandmark(item.node) ?? describeElement(item.node)}: use realistic, varied sample values (company names such as Northwind Traders for customers).`, item.node, "warning")
        }
    }
    for (const node of page.all) {
        if (isWithin(node, NOT_COPY) || page.styles.get(node)?.hidden) continue
        if (node.tag === "canvas") add("placeholder|canvas", `<canvas> in ${where(node)} draws nothing: scripts don't run in the design's frame. Draw the chart as bars from divs, with labels.`, node)
        const named = [node.attributes.get("id") ?? "", ...node.classes].some((name) => CHART_BOX.test(name))
        if (named && elementChildren(node).length === 0 && !textContent(node) && !/gradient/i.test(node.attributes.get("style") ?? "")) {
            add(`placeholder|empty|${describeElement(node)}`, `Empty chart box ${where(node)}. ${CHART_FIX}`, node)
        }
    }
    return [...groups.entries()].map(([key, group]) => ({ kind: "placeholder", severity: group.severity, key, count: group.count, regions: regionsOf(group.nodes), message: `${group.message}${group.count > 1 ? ` (${group.count} places)` : ""}` }))
}

// --- Tables ------------------------------------------------------------------------------------

const normalizeHeader = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()

const singular = (text: string) => text.replace(/s\b/g, "")

const editDistance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index)
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0]
        row[0] = i
        for (let j = 1; j <= b.length; j++) {
            const current = row[j]
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
            previous = current
        }
    }
    return row[b.length]
}

// Two headers that say the same thing: "Status" and "Order status", "Order" and "Orders"
const nearDuplicates = (a: string, b: string) => {
    if (a === b) return false
    const [wordsA, wordsB] = [a.split(" "), b.split(" ")]
    const within = (small: string[], large: string[]) => small.length < large.length && small.every((word) => large.includes(word))
    return singular(a) === singular(b) || within(wordsA, wordsB) || within(wordsB, wordsA) || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1)
}

const headerCells = (table: HtmlElement) => {
    // Its rows, not a nested table's, in order
    const rows: HtmlElement[] = []
    const pending = elementChildren(table).reverse()
    while (pending.length > 0) {
        const node = pending.pop()!
        if (node.tag === "table") continue
        if (node.tag === "tr") rows.push(node)
        else pending.push(...elementChildren(node).reverse())
    }
    const head = rows.find((row) => row.parent?.tag === "thead") ?? rows.find((row) => elementChildren(row).some((cell) => cell.tag === "th"))
    return head ? elementChildren(head).filter((cell) => cell.tag === "th" || cell.tag === "td") : []
}

const tableIssues = (page: Page, context: ValidationContext): Issue[] => {
    const issues: Issue[] = []
    page.all.filter((node) => node.tag === "table").forEach((table, index) => {
        const label = nearestLandmark(table) ?? `${index + 1}`
        const headers = headerCells(table).map((cell) => ({ text: textContent(cell), normal: normalizeHeader(textContent(cell)) })).filter((header) => header.normal)
        const seen = new Map<string, number>()
        for (const header of headers) seen.set(header.normal, (seen.get(header.normal) ?? 0) + 1)
        for (const [normal, times] of seen) {
            if (times < 2) continue
            const text = headers.find((header) => header.normal === normal)!.text
            issues.push({ kind: "duplicate-column", severity: "error", key: `duplicate-column|${normal}`, count: times, regions: regionsOf([table]), message: `Table ${label} has the column ${quote(text)} ${times === 2 ? "twice" : `${times} times`}. Keep one, and drop the others from the header and every row.` })
        }
        if (context.mode !== "refine") return
        const unique = [...new Map(headers.map((header) => [header.normal, header])).values()]
        for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
                if (!nearDuplicates(unique[i].normal, unique[j].normal)) continue
                const pair = [unique[i].normal, unique[j].normal].sort()
                issues.push({ kind: "duplicate-column", severity: "error", key: `duplicate-column|${pair.join("|")}`, count: 1, regions: regionsOf([table]), message: `Table ${label} has the columns ${quote(unique[i].text)} and ${quote(unique[j].text)}, which say the same thing. Keep one, and drop the other from the header and every row.` })
            }
        }
    })
    return issues
}

// --- Images ------------------------------------------------------------------------------------

// A box that keeps its size without its image: an aspect ratio, or a height that isn't a percentage
const holdsSize = (values: Map<string, string>) => {
    const aspect = values.get("aspect-ratio")?.trim().toLowerCase()
    if (aspect && aspect !== "auto") return true
    return ["height", "min-height"].some((property) => {
        const value = values.get(property)?.trim().toLowerCase()
        return Boolean(value && /^(?:calc\(|clamp\(|min\(|max\()?[\d.]+(px|rem|em|vh|svh|dvh|lvh)\b/.test(value) && parseFloat(value.replace(/^[a-z]+\(/, "")) > 0)
    })
}

const imageIssues = (page: Page): Issue[] => {
    const issues: Issue[] = []
    for (const node of page.all) {
        if (node.tag !== "img" || isWithin(node, new Set(["svg", "math"])) || page.styles.get(node)?.hidden) continue
        const own = page.styles.get(node)!.values
        const attributeSize = ["width", "height"].every((name) => Number.parseFloat(node.attributes.get(name) ?? "") > 0)
        if (holdsSize(own) || attributeSize) continue
        // Its box keeps the space even if it's empty
        const boxes = [node.parent, node.parent?.parent].filter((box): box is HtmlElement => Boolean(box && box.tag !== ROOT))
        if (boxes.some((box) => holdsSize(page.styles.get(box)!.values))) continue
        const alt = node.attributes.get("alt") ?? ""
        issues.push({
            kind: "image-size",
            severity: "error",
            key: `image-size|${alt}|${node.attributes.get("data-slot") ?? ""}`,
            count: 1,
            regions: regionsOf([node]),
            message: `${where(node)} has no height or aspect ratio, so it collapses to nothing when the image doesn't load. Give its box an aspect-[w/h] class (the slot's shape) with c-muted-bg behind it.`,
        })
    }
    return issues
}

// --- Heights that resolve to nothing --------------------------------------------------------------

// Whether an element's height is set: a length, an aspect ratio, or a percentage of a parent whose
// height is set in turn. auto, min-height alone and fit-content aren't.
const definiteHeight = (node: HtmlElement | null, styles: Map<HtmlElement, ComputedStyle>): boolean => {
    for (let at = node; at && at.tag !== ROOT; at = at.parent) {
        const values = styles.get(at)!.values
        const aspect = values.get("aspect-ratio")?.trim().toLowerCase()
        if (aspect && aspect !== "auto") return true
        const height = values.get("height")?.trim().toLowerCase()
        if (!height || height === "auto" || /content|inherit|initial|unset/.test(height)) return false
        if (height.endsWith("%")) continue
        return parseFloat(height.replace(/^[a-z]+\(/, "")) > 0
    }
    return false
}

// An empty element sized as a percentage of a box with no set height draws 0px tall: a chart's bars
// in columns that only fit their content
const collapsedHeightIssues = (page: Page): Issue[] => {
    const groups = new Map<string, HtmlElement[]>()
    for (const node of page.all) {
        if (node.tag === "img" || node.tag === ROOT || isWithin(node, new Set(["svg", "math"]))) continue
        const style = page.styles.get(node)!
        const height = style.values.get("height")?.trim()
        if (style.hidden || !height?.endsWith("%") || parseFloat(height) <= 0) continue
        if (/^(absolute|fixed)$/.test(style.values.get("position")?.trim() ?? "")) continue
        if (elementChildren(node).length > 0 || textContent(node)) continue
        if (definiteHeight(node.parent, page.styles)) continue
        const key = `collapsed-height|${describeElement(node)}`
        groups.set(key, [...(groups.get(key) ?? []), node])
    }
    return [...groups.entries()].map(([key, nodes]) => ({
        kind: "collapsed-height",
        severity: "error",
        key,
        count: nodes.length,
        regions: regionsOf(nodes),
        message: `${describeElement(nodes[0])}${places(nodes.length)}${nearestLandmark(nodes[0].parent) ? ` in ${nearestLandmark(nodes[0].parent)}` : ""} has a percentage height inside a box with no set height, so it draws 0px tall. Give each bar's column h-full and justify-end inside a row with a fixed height (h-48), or give the bars fixed px heights.`,
    }))
}

// --- Inline SVG --------------------------------------------------------------------------------

const svgIssues = (page: Page): Issue[] => {
    const svgs = page.all.filter((node) => (node.tag === "svg" || node.tag === "math") && !isWithin(node.parent, new Set(["svg", "math"])))
    if (svgs.length === 0) return []
    const spots = [...new Set(svgs.map((node) => nearestLandmark(node.parent) ?? describeElement(node.parent!)))].slice(0, 3)
    return [{
        kind: "inline-svg",
        severity: "error",
        key: "inline-svg",
        count: svgs.length,
        regions: regionsOf(svgs),
        message: `${svgs.length} inline <svg>${svgs.length === 1 ? "" : "s"} (in ${spots.join(", ")}): the design's frame removes inline SVG, so ${svgs.length === 1 ? "it shows" : "they show"} as nothing. Use a short text label or a plain Unicode symbol (→ ✓ ✕ •) for each icon, and draw any chart from divs.`,
    }]
}

// --- Checking a design -------------------------------------------------------------------------

const findIssues = (html: string, contract: DesignContract, context: ValidationContext): Issue[] => {
    const page = readPage(html, context.width ?? DEFAULT_FRAME_WIDTH)
    const copy = copyOf(page)
    return [
        ...contrastIssues(page, contract),
        ...colorIssues(page, contract, context),
        ...copyIssues(copy, context),
        ...nameIssues(copy, context),
        ...placeholderIssues(page, copy, context),
        ...tableIssues(page, context),
        ...imageIssues(page),
        ...collapsedHeightIssues(page),
        ...svgIssues(page),
    ]
}

// Every problem the checks find in a design, errors and warnings. With context.previousHtml, a problem
// the earlier page already had, as often, is a warning: only what this version brought in is an error.
export const validate = (html: string, contract: DesignContract, context: ValidationContext = {}): Issue[] => {
    const issues = findIssues(html, contract, context)
    if (!context.previousHtml) return issues
    const earlier = new Map(findIssues(context.previousHtml, contract, { ...context, previousHtml: undefined }).map((issue) => [issue.key, issue]))
    return issues.map((issue) => {
        const before = earlier.get(issue.key)
        if (!before || before.count < issue.count || issue.severity !== "error") return issue
        // Carried over: still an error where the refine's request works, a warning anywhere else
        if (context.mode === "refine" && context.request && touchedBy(issue, context.request)) return { ...issue, message: `${issue.message} (It was already there, in the part this request changes.)` }
        return { ...issue, severity: "warning", message: `${issue.message} (It was already there.)` }
    })
}

export const errorCount = (issues: Issue[]) => issues.filter((issue) => issue.severity === "error").length

// The errors as the repair request lists them, one per line, most important first
export const REPAIR_LIST_LIMIT = 20

const KIND_ORDER: IssueKind[] = ["contrast", "duplicate-column", "image-size", "collapsed-height", "inline-svg", "placeholder", "name", "copy", "color"]

export const repairProblems = (issues: Issue[]) => {
    const errors = issues
        .filter((issue) => issue.severity === "error")
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const listed = errors.slice(0, REPAIR_LIST_LIMIT).map((issue) => issue.message)
    if (errors.length > REPAIR_LIST_LIMIT) listed.push(`And ${errors.length - REPAIR_LIST_LIMIT} more problems of the kinds above.`)
    return listed
}

// Counts for a log line, with none of the page's words in it
export const issueSummary = (issues: Issue[]) => ({
    errors: errorCount(issues),
    warnings: issues.length - errorCount(issues),
    kinds: Object.fromEntries(KIND_ORDER.map((kind) => [kind, issues.filter((issue) => issue.kind === kind && issue.severity === "error").length]).filter(([, count]) => count)),
})
