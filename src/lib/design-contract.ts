import type { StyleGuide, TypographyStyle } from "@/redux/api/style-guide"
import { primaryFamily } from "./web-fonts"

// The design contract: what a project's style guide promises every design generated from it, as
// structured tokens the generate routes hand the model as JSON. It's built fresh for each request
// and never saved, so the stored style guides stay exactly as they were generated.
//
// Style guides from before PR #163 don't name their swatches after the roles, and none of them set
// spacing, radius or a container width, so every token here has a fallback that depends only on the
// guide: the same guide always gives the same contract.

// Bump when the contract's shape or rules change: prompts and eval snapshots say which they follow
export const DESIGN_CONTRACT_VERSION = 1

export const COLOR_ROLES = [
    "background", "foreground", "card", "cardForeground", "popover", "popoverForeground",
    "primary", "primaryForeground", "secondary", "secondaryForeground", "muted", "mutedForeground",
    "accent", "accentForeground", "destructive", "destructiveForeground", "border", "input", "ring",
] as const
export type ColorRole = (typeof COLOR_ROLES)[number]

// Each surface with the text that sits on it, the pairs a design may use
export const CONTRAST_PAIRS: readonly (readonly [ColorRole, ColorRole])[] = [
    ["background", "foreground"],
    ["card", "cardForeground"],
    ["popover", "popoverForeground"],
    ["primary", "primaryForeground"],
    ["secondary", "secondaryForeground"],
    ["muted", "mutedForeground"],
    ["accent", "accentForeground"],
    ["destructive", "destructiveForeground"],
]

// WCAG 2.2 AA
export const NORMAL_TEXT_CONTRAST = 4.5
export const LARGE_TEXT_CONTRAST = 3

export const TYPE_ROLES = ["h1", "h2", "h3", "body", "small", "button", "label"] as const
export type TypeRole = (typeof TYPE_ROLES)[number]
export type FontRole = "heading" | "body" | "ui"

const FONT_ROLE_OF: Record<TypeRole, FontRole> = { h1: "heading", h2: "heading", h3: "heading", body: "body", small: "body", button: "ui", label: "ui" }

export type TypeStyle = {
    font: FontRole
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing: string
    // Whether the guide set this style, or the contract filled it in
    source: "guide" | "default"
}

export type ContrastCheck = {
    background: ColorRole
    foreground: ColorRole
    // The guide's colors and their ratio
    colors: [string, string]
    ratio: number
    normalText: boolean
    largeText: boolean
    // Set when the pair fails for normal text: the text color the contract uses instead
    corrected?: { foreground: string; ratio: number; original: string }
}

export type DesignContract = {
    version: number
    theme: { name: string; description: string }
    // What the .c-* classes use: the guide's colors, with any failing text color corrected
    colors: Record<ColorRole, string>
    contrast: ContrastCheck[]
    fonts: Record<FontRole, { family: string; stack: string }>
    typeScale: Record<TypeRole, TypeStyle>
    spacing: typeof SPACING
    radius: typeof RADIUS
    container: typeof CONTAINER
    // Fallbacks used, duplicates ignored and colors corrected, in words, for logs and snapshots
    notes: string[]
}

// The style guide sets none of these yet, so they're Linea's defaults, by how dense the layout is.
// Tailwind classes, since that's how the designs lay themselves out.
const SPACING = {
    note: "Tailwind's 4px steps. Marketing sections are generous; dense app screens (dashboards, tables, settings, forms) are compact.",
    marketing: { section: "py-16 md:py-24 px-6", stack: "gap-4 md:gap-6", grid: "gap-6 md:gap-8", card: "p-6 md:p-8", button: "px-6 py-3" },
    app: { section: "p-4 md:p-6", stack: "gap-2 md:gap-3", grid: "gap-3 md:gap-4", card: "p-4", tableCell: "px-3 py-2", field: "gap-1.5", button: "px-4 py-2" },
} as const

const RADIUS = { control: "0.5rem (rounded-lg)", card: "0.75rem (rounded-xl)", pill: "9999px (rounded-full)" } as const

const CONTAINER = { maxWidth: "80rem", className: "mx-auto max-w-7xl", padding: "px-6 on marketing pages, px-4 in app screens" } as const

// The type scale the style guide prompt asks for, for any style a guide leaves out
const DEFAULT_TYPE: Record<TypeRole, Omit<TypeStyle, "font" | "source">> = {
    h1: { fontSize: "2.25rem", fontWeight: "700", lineHeight: "1.2", letterSpacing: "normal" },
    h2: { fontSize: "1.875rem", fontWeight: "600", lineHeight: "1.25", letterSpacing: "normal" },
    h3: { fontSize: "1.5rem", fontWeight: "600", lineHeight: "1.3", letterSpacing: "normal" },
    body: { fontSize: "1rem", fontWeight: "400", lineHeight: "1.5", letterSpacing: "normal" },
    small: { fontSize: "0.875rem", fontWeight: "400", lineHeight: "1.4", letterSpacing: "normal" },
    button: { fontSize: "1rem", fontWeight: "500", lineHeight: "1.25", letterSpacing: "normal" },
    label: { fontSize: "0.875rem", fontWeight: "500", lineHeight: "1.4", letterSpacing: "normal" },
}

const DEFAULT_FAMILY = "Inter"

// --- Colors -----------------------------------------------------------------------------------

// #RGB, #RRGGBB and either with alpha, as #RRGGBB (alpha dropped), or null
export const normalizeHex = (value: string | undefined | null): string | null => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec((value ?? "").trim())
    if (!match) return null
    const digits = match[1].length <= 4 ? [...match[1].slice(0, 3)].map((digit) => digit + digit).join("") : match[1].slice(0, 6)
    return `#${digits.toUpperCase()}`
}

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))

const toHex = (values: number[]) =>
    `#${values.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("").toUpperCase()}`

// sRGB mix: `amount` 0 is from, 1 is to
const mix = (from: string, to: string, amount: number) => {
    const target = channels(to)
    return toHex(channels(from).map((value, index) => value + (target[index] - value) * amount))
}

// WCAG relative luminance
export const luminance = (hex: string) => {
    const [r, g, b] = channels(hex).map((value) => {
        const s = value / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastRatio = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

const round2 = (value: number) => Math.round(value * 100) / 100

// Black or white text, whichever reads better on the background
const textOn = (background: string) =>
    contrastRatio(background, "#111111") >= contrastRatio(background, "#FFFFFF") ? "#111111" : "#FFFFFF"

// The text color moved toward black or white by as little as it takes to reach `target` on the
// background. The background stays, since it's usually the brand's color; the text keeps its hue
// as far as it can. It first tries the way the text already leans (darker text gets darker), and
// only goes the other way when that can't get there.
export const correctedForeground = (background: string, foreground: string, target = NORMAL_TEXT_CONTRAST) => {
    const ends = luminance(foreground) <= luminance(background) ? ["#000000", "#FFFFFF"] : ["#FFFFFF", "#000000"]
    for (const end of ends) {
        if (contrastRatio(background, end) < target) continue
        // The smallest move that passes, checked on the rounded color the design will use
        let low = 0
        let high = 1
        for (let step = 0; step < 24; step++) {
            const middle = (low + high) / 2
            if (contrastRatio(background, mix(foreground, end, middle)) >= target) high = middle
            else low = middle
        }
        return mix(foreground, end, high)
    }
    return textOn(background)
}

// What the five color sections hold, in order, as the style guide route asks for them. Guides whose
// swatches aren't named after their roles fall back on where each swatch sits.
const SECTION_ROLES: Record<string, ColorRole[]> = {
    "primary colors": ["background", "foreground", "primary", "primaryForeground"],
    "secondary and accent colors": ["secondary", "secondaryForeground", "accent", "accentForeground"],
    "ui component colors": ["card", "cardForeground", "popover", "popoverForeground", "muted", "mutedForeground"],
    "utility and form colors": ["border", "input", "ring"],
    "status and feedback colors": ["destructive", "destructiveForeground"],
}

const words = (value: string) =>
    value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()

// Names for the surfaces, as people write them
const SURFACES: Record<string, ColorRole> = {
    primary: "primary", brand: "primary", secondary: "secondary", accent: "accent", highlight: "accent",
    muted: "muted", subtle: "muted", card: "card", surface: "card", popover: "popover", modal: "popover",
    dropdown: "popover", destructive: "destructive", error: "destructive", danger: "destructive",
}

const foregroundOf = (surface: ColorRole): ColorRole | null =>
    surface === "background" ? "foreground" : (COLOR_ROLES as readonly string[]).includes(`${surface}Foreground`) ? (`${surface}Foreground` as ColorRole) : null

// A swatch name as a role: "Primary Foreground", "primary-foreground", "Text on Primary", "Card FG",
// "Main Background", "Focus Ring"... or null for names like "Sage Green"
export const colorRoleOf = (name: string): ColorRole | null => {
    const value = words(name).replace(/\b(colou?r|the)\b/g, " ").replace(/\s+/g, " ").trim()
    if (!value) return null
    const onSurface = /^(?:text on|on|foreground on|fg on) (\w+)$/.exec(value) ?? /^(\w+) (?:foreground|fg)$/.exec(value)
    if (onSurface) {
        const surface = onSurface[1] === "background" || onSurface[1] === "page" ? "background" : SURFACES[onSurface[1]]
        return surface ? foregroundOf(surface) : null
    }
    if (/^(?:main |page |base )?(?:background|bg)$/.test(value)) return "background"
    if (/^(?:main |page |base |body )?(?:foreground|fg)$/.test(value)) return "foreground"
    if (/^(?:border|divider|outline|stroke)s?$/.test(value)) return "border"
    if (/^(?:input|field|form field|input background)s?$/.test(value)) return "input"
    if (/^(?:ring|focus|focus ring)$/.test(value)) return "ring"
    return SURFACES[value] ?? null
}

// A swatch's description as a role, for guides whose names don't say. Only descriptions that open
// with what the color is for count ("Text on primary buttons", "Main background"), so "used for the
// main background of cards" isn't read as the page's background.
const colorRoleFromDescription = (description: string | undefined): ColorRole | null => {
    const value = words(description ?? "").replace(/^(?:the|a|an) /, "")
    const onSurface = /^text (?:colou?r )?on (?:the )?(primary|secondary|accent|muted|card|popover|destructive)\b/.exec(value)
    if (onSurface) return foregroundOf(SURFACES[onSurface[1]])
    if (/^(?:main |page )?background\b/.test(value)) return "background"
    if (/^(?:main |primary |body )?text\b/.test(value)) return "foreground"
    if (/\bcall to action\b/.test(value)) return "primary"
    if (/^(?:error|destructive|danger)\b/.test(value)) return "destructive"
    if (/^(?:borders?|dividers?)\b/.test(value)) return "border"
    if (/^focus\b/.test(value)) return "ring"
    return null
}

const colorRoles = (guide: StyleGuide, notes: string[]) => {
    const found: Partial<Record<ColorRole, string>> = {}
    const swatches = (guide.colorSections ?? []).flatMap((section, sectionIndex) =>
        (section?.swatches ?? []).map((swatch, index) => ({ swatch, section: words(section?.title ?? ""), sectionIndex, index }))
    )
    const pending: typeof swatches = []

    // By name first, then by description, then by where the swatch sits
    for (const entry of swatches) {
        const hex = normalizeHex(entry.swatch?.hexColor)
        if (!hex) {
            notes.push(`Swatch "${entry.swatch?.name}" has no valid hex color (${JSON.stringify(entry.swatch?.hexColor)}); ignored.`)
            continue
        }
        const role = colorRoleOf(entry.swatch?.name ?? "")
        if (!role) {
            pending.push(entry)
        } else if (found[role]) {
            notes.push(`Duplicate ${role} swatch "${entry.swatch.name}" (${hex}) ignored; the first one (${found[role]}) is used.`)
        } else {
            found[role] = hex
        }
    }
    const unplaced: typeof swatches = []
    for (const entry of pending) {
        const role = colorRoleFromDescription(entry.swatch.description)
        if (role && !found[role]) {
            found[role] = normalizeHex(entry.swatch.hexColor)!
            notes.push(`Swatch "${entry.swatch.name}" read as ${role} from its description.`)
        } else {
            unplaced.push(entry)
        }
    }
    for (const entry of unplaced) {
        const role = SECTION_ROLES[entry.section]?.[entry.index]
        if (role && !found[role]) {
            found[role] = normalizeHex(entry.swatch.hexColor)!
            notes.push(`Swatch "${entry.swatch.name}" read as ${role} from its place in "${guide.colorSections[entry.sectionIndex].title}".`)
        } else {
            notes.push(`Swatch "${entry.swatch.name}" matches no free color role; ignored.`)
        }
    }

    // Anything still missing comes from the roles that are there, in a fixed order
    const derived: [ColorRole, () => string][] = [
        ["background", () => "#FFFFFF"],
        ["foreground", () => textOn(found.background!)],
        ["primary", () => found.accent ?? found.secondary ?? found.foreground!],
        ["primaryForeground", () => textOn(found.primary!)],
        ["secondary", () => mix(found.background!, found.foreground!, 0.08)],
        ["secondaryForeground", () => textOn(found.secondary!)],
        ["accent", () => found.primary!],
        ["accentForeground", () => textOn(found.accent!)],
        ["card", () => found.background!],
        ["cardForeground", () => found.foreground!],
        ["popover", () => found.card!],
        ["popoverForeground", () => found.cardForeground!],
        ["muted", () => mix(found.background!, found.foreground!, 0.06)],
        ["mutedForeground", () => mix(found.foreground!, found.background!, 0.35)],
        ["destructive", () => "#DC2626"],
        ["destructiveForeground", () => textOn(found.destructive!)],
        ["border", () => mix(found.background!, found.foreground!, 0.15)],
        ["input", () => found.border!],
        ["ring", () => found.primary!],
    ]
    const missing: ColorRole[] = []
    for (const [role, derive] of derived) {
        if (found[role]) continue
        found[role] = derive()
        missing.push(role)
    }
    if (missing.length > 0) notes.push(`Not in the guide, so derived from its other colors: ${missing.join(", ")}.`)
    return found as Record<ColorRole, string>
}

const contrastChecks = (colors: Record<ColorRole, string>, notes: string[]) =>
    CONTRAST_PAIRS.map(([background, foreground]): ContrastCheck => {
        const ratio = contrastRatio(colors[background], colors[foreground])
        const check: ContrastCheck = {
            background,
            foreground,
            colors: [colors[background], colors[foreground]],
            ratio: round2(ratio),
            normalText: ratio >= NORMAL_TEXT_CONTRAST,
            largeText: ratio >= LARGE_TEXT_CONTRAST,
        }
        if (!check.normalText) {
            const corrected = correctedForeground(colors[background], colors[foreground])
            check.corrected = { foreground: corrected, ratio: round2(contrastRatio(colors[background], corrected)), original: colors[foreground] }
            notes.push(
                `${foreground} ${colors[foreground]} on ${background} ${colors[background]} is ${check.ratio}:1, under ${NORMAL_TEXT_CONTRAST}:1 for normal text` +
                `${check.largeText ? ` (enough for large text)` : ` and ${LARGE_TEXT_CONTRAST}:1 for large text`}; corrected to ${corrected} (${check.corrected.ratio}:1).`
            )
        }
        return check
    })

// --- Typography -------------------------------------------------------------------------------

// A style's name as a role in the type scale: "H1", "Heading 2", "Display", "Body", "Caption"...
export const typeRoleOf = (name: string): TypeRole | null => {
    const value = words(name).replace(/\b(text|style|font)\b/g, " ").replace(/\s+/g, " ").trim()
    if (/^(?:h ?1|heading 1|display|hero(?: title| heading)?|page title)$/.test(value)) return "h1"
    if (/^(?:h ?2|heading 2|section (?:title|heading)|subtitle)$/.test(value)) return "h2"
    if (/^(?:h ?3|heading 3|subheading|card title)$/.test(value)) return "h3"
    if (/^(?:body|paragraph|body regular|body default|lead)$/.test(value)) return "body"
    if (/^(?:small|caption|meta|body small|fine print|helper)$/.test(value)) return "small"
    if (/^(?:button|cta|button label)$/.test(value)) return "button"
    if (/^(?:label|input label|form label|overline|tag)$/.test(value)) return "label"
    return null
}

// Where unnamed styles go, by their section's title, in order
const sectionTypeRoles = (title: string): TypeRole[] => {
    const value = words(title)
    if (/head|display|title/.test(value)) return ["h1", "h2", "h3"]
    if (/body|text|paragraph|content/.test(value)) return ["body", "small"]
    if (/ui|element|interface|component|control|button|label|form/.test(value)) return ["button", "label", "small"]
    return []
}

const WEIGHT_WORDS: Record<string, string> = {
    thin: "100", hairline: "100", extralight: "200", ultralight: "200", light: "300", regular: "400", normal: "400",
    book: "400", medium: "500", semibold: "600", demibold: "600", bold: "700", extrabold: "800", ultrabold: "800",
    black: "900", heavy: "900",
}

const LINE_HEIGHT_WORDS: Record<string, string> = { none: "1", tight: "1.25", snug: "1.375", normal: "1.5", relaxed: "1.625", loose: "2" }

const LENGTH = /^-?\d*\.?\d+(?:px|rem|em|%|pt)$/

const cssSize = (value: string | undefined) => {
    const text = (value ?? "").trim().toLowerCase().replace(/\s+/g, "")
    if (LENGTH.test(text) && !text.startsWith("-")) return text
    if (/^(?:clamp|min|max|calc)\(.+\)$/.test(text)) return text
    // A bare number: pixels, unless it's small enough to be rem
    if (/^\d*\.?\d+$/.test(text)) return Number(text) > 4 ? `${Number(text)}px` : `${Number(text)}rem`
    return null
}

const cssWeight = (value: string | undefined) => {
    const text = (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "")
    if (/^[1-9]00$/.test(text)) return text
    return WEIGHT_WORDS[text] ?? null
}

const cssLineHeight = (value: string | undefined) => {
    const text = (value ?? "").trim().toLowerCase().replace(/\s+/g, "")
    if (/^\d*\.?\d+$/.test(text) || LENGTH.test(text)) return text
    return LINE_HEIGHT_WORDS[text] ?? null
}

const cssLetterSpacing = (value: string | undefined) => {
    const text = (value ?? "").trim().toLowerCase().replace(/\s+/g, "")
    if (text === "normal" || text === "0") return text
    if (/^-?\d*\.?\d+(?:px|rem|em)$/.test(text)) return text
    return null
}

const SERIF = /serif|slab|garamond|baskerville|caslon|bodoni|didot|playfair|merriweather|lora|georgia|times|fraunces|cormorant|spectral|prata|alegreya|cardo|bitter|domine|arvo/i

// A family and the stack the design should use, keeping the guide's own fallback if it wrote one
const fontOf = (fontFamily: string) => {
    const family = primaryFamily(fontFamily) || DEFAULT_FAMILY
    const generic = /monospace/i.test(fontFamily) || /mono|code|courier/i.test(family)
        ? "ui-monospace, monospace"
        : /(?:^|,)\s*serif\s*$/i.test(fontFamily) || (SERIF.test(family) && !/sans/i.test(family))
            ? "ui-serif, Georgia, serif"
            : "ui-sans-serif, system-ui, sans-serif"
    return { family, stack: `'${family}', ${generic}` }
}

const typography = (guide: StyleGuide, notes: string[]) => {
    const styles: Partial<Record<TypeRole, { style: TypographyStyle }>> = {}
    const unnamed: { style: TypographyStyle; roles: TypeRole[] }[] = []
    for (const section of guide.typographySections ?? []) {
        for (const style of section?.styles ?? []) {
            const role = typeRoleOf(style?.name ?? "")
            if (!role) {
                unnamed.push({ style, roles: sectionTypeRoles(section.title ?? "") })
            } else if (styles[role]) {
                notes.push(`Duplicate ${role} type style "${style.name}" ignored; the first one is used.`)
            } else {
                styles[role] = { style }
            }
        }
    }
    for (const { style, roles } of unnamed) {
        const role = roles.find((candidate) => !styles[candidate])
        if (role) {
            styles[role] = { style }
            notes.push(`Type style "${style.name}" read as ${role} from its section.`)
        } else {
            notes.push(`Type style "${style.name}" matches no free role in the scale; ignored.`)
        }
    }

    // The families: each role's own, then the nearest one the guide has
    const familyOf = (roles: TypeRole[]) => roles.map((role) => styles[role]?.style.fontFamily).find((family) => primaryFamily(family))
    const headingFamily = familyOf(["h1", "h2", "h3"])
    const bodyFamily = familyOf(["body", "small"])
    const uiFamily = familyOf(["button", "label"])
    const fonts: Record<FontRole, { family: string; stack: string }> = {
        heading: fontOf(headingFamily ?? bodyFamily ?? uiFamily ?? DEFAULT_FAMILY),
        body: fontOf(bodyFamily ?? headingFamily ?? uiFamily ?? DEFAULT_FAMILY),
        ui: fontOf(uiFamily ?? bodyFamily ?? headingFamily ?? DEFAULT_FAMILY),
    }
    if (!headingFamily && !bodyFamily && !uiFamily) notes.push(`No font family in the guide; ${DEFAULT_FAMILY} is used.`)

    const typeScale = {} as Record<TypeRole, TypeStyle>
    const defaulted: TypeRole[] = []
    for (const role of TYPE_ROLES) {
        const style = styles[role]?.style
        const fallback = DEFAULT_TYPE[role]
        if (!style) defaulted.push(role)
        typeScale[role] = {
            font: FONT_ROLE_OF[role],
            fontSize: cssSize(style?.fontSize) ?? fallback.fontSize,
            fontWeight: cssWeight(style?.fontWeight) ?? fallback.fontWeight,
            lineHeight: cssLineHeight(style?.lineHeight) ?? fallback.lineHeight,
            letterSpacing: cssLetterSpacing(style?.letterSpacing) ?? fallback.letterSpacing,
            source: style ? "guide" : "default",
        }
    }
    if (defaulted.length > 0) notes.push(`Not in the guide's type scale, so Linea's defaults: ${defaulted.join(", ")}.`)
    return { fonts, typeScale }
}

// --- The contract -----------------------------------------------------------------------------

export const buildDesignContract = (guide: StyleGuide): DesignContract => {
    const notes: string[] = []
    const guideColors = colorRoles(guide, notes)
    const contrast = contrastChecks(guideColors, notes)
    const colors = { ...guideColors }
    for (const check of contrast) {
        if (check.corrected) colors[check.foreground] = check.corrected.foreground
    }
    const { fonts, typeScale } = typography(guide, notes)
    return {
        version: DESIGN_CONTRACT_VERSION,
        theme: { name: guide.theme?.trim() || "Untitled", description: guide.description?.trim() ?? "" },
        colors,
        contrast,
        fonts,
        typeScale,
        spacing: SPACING,
        radius: RADIUS,
        container: CONTAINER,
        notes,
    }
}

// The contract's corrections, for the server log
export const contractCorrections = (contract: DesignContract) =>
    contract.contrast.filter((check) => check.corrected)
