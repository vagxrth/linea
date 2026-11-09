// Colors as a design's frame shows them: CSS color values (hex, rgb(), hsl(), oklch() and the common
// names) and Tailwind's color classes. The frame compiles a design's classes with Tailwind 4's default
// palette and Linea's own theme (src/lib/design-css.ts), and its <html> is class="dark", so Linea's
// theme colors (bg-primary, text-muted-foreground…) are the app's dark ones there, not the design's.

export type Rgba = { r: number; g: number; b: number; a: number }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a: clamp01(a) })

export const TRANSPARENT = rgba(0, 0, 0, 0)

// --- Conversions -------------------------------------------------------------------------------

// sRGB from OKLCH, clipped to what an sRGB screen can show
export const oklchToRgb = (lightness: number, chroma: number, hue: number, alpha = 1): Rgba => {
    const radians = (hue * Math.PI) / 180
    const [a, b] = [chroma * Math.cos(radians), chroma * Math.sin(radians)]
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
    const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    const [r, g, bl] = linear.map((value) => {
        const v = clamp01(value)
        return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    })
    return rgba(r, g, bl, alpha)
}

const hslToRgb = (hue: number, saturation: number, lightness: number, alpha = 1): Rgba => {
    const s = clamp01(saturation)
    const l = clamp01(lightness)
    const k = (n: number) => (n + hue / 30) % 12
    const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
    return rgba(Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), alpha)
}

// "#RRGGBB", alpha dropped
export const toHex = ({ r, g, b }: Rgba) =>
    `#${[r, g, b].map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("").toUpperCase()}`

// `top` drawn over an opaque `bottom`
export const over = (top: Rgba, bottom: Rgba): Rgba => {
    const mixed = (a: number, b: number) => Math.round(a * top.a + b * (1 - top.a))
    return rgba(mixed(top.r, bottom.r), mixed(top.g, bottom.g), mixed(top.b, bottom.b), 1)
}

// --- Parsing -----------------------------------------------------------------------------------

// The CSS color names a design might plausibly write, as hex
const NAMED: Record<string, string> = {
    white: "#FFFFFF", black: "#000000", red: "#FF0000", green: "#008000", blue: "#0000FF", gray: "#808080", grey: "#808080",
    silver: "#C0C0C0", maroon: "#800000", navy: "#000080", olive: "#808000", purple: "#800080", teal: "#008080", lime: "#00FF00",
    yellow: "#FFFF00", orange: "#FFA500", pink: "#FFC0CB", brown: "#A52A2A", beige: "#F5F5DC", ivory: "#FFFFF0", gold: "#FFD700",
    coral: "#FF7F50", salmon: "#FA8072", tomato: "#FF6347", crimson: "#DC143C", indigo: "#4B0082", violet: "#EE82EE", khaki: "#F0E68C",
    lavender: "#E6E6FA", linen: "#FAF0E6", snow: "#FFFAFA", whitesmoke: "#F5F5F5", gainsboro: "#DCDCDC", lightgray: "#D3D3D3",
    lightgrey: "#D3D3D3", darkgray: "#A9A9A9", darkgrey: "#A9A9A9", dimgray: "#696969", dimgrey: "#696969", slategray: "#708090",
    slategrey: "#708090", lightslategray: "#778899", darkslategray: "#2F4F4F", aliceblue: "#F0F8FF", ghostwhite: "#F8F8FF",
    honeydew: "#F0FFF0", mintcream: "#F5FFFA", azure: "#F0FFFF", seashell: "#FFF5EE", oldlace: "#FDF5E6", floralwhite: "#FFFAF0",
    cornsilk: "#FFF8DC", antiquewhite: "#FAEBD7", wheat: "#F5DEB3", tan: "#D2B48C", sienna: "#A0522D", chocolate: "#D2691E",
    peru: "#CD853F", firebrick: "#B22222", darkred: "#8B0000", darkgreen: "#006400", forestgreen: "#228B22", seagreen: "#2E8B57",
    darkblue: "#00008B", midnightblue: "#191970", royalblue: "#4169E1", steelblue: "#4682B4", skyblue: "#87CEEB",
    lightblue: "#ADD8E6", cadetblue: "#5F9EA0", darkcyan: "#008B8B", cyan: "#00FFFF", aqua: "#00FFFF", magenta: "#FF00FF",
    fuchsia: "#FF00FF", orchid: "#DA70D6", plum: "#DDA0DD", thistle: "#D8BFD8", mistyrose: "#FFE4E1", lavenderblush: "#FFF0F5",
    rebeccapurple: "#663399", goldenrod: "#DAA520", darkorange: "#FF8C00", olivedrab: "#6B8E23", darkolivegreen: "#556B2F",
}

const fromHex = (hex: string): Rgba | null => {
    const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim())
    if (!match) return null
    const digits = match[1].length <= 4 ? [...match[1]].map((digit) => digit + digit).join("") : match[1]
    const value = (at: number) => parseInt(digits.slice(at, at + 2), 16)
    return rgba(value(0), value(2), value(4), digits.length === 8 ? value(6) / 255 : 1)
}

// A color function's numbers: "15 118 110 / 50%", "15, 118, 110, 0.5"
const functionArguments = (inside: string) => {
    const [main, slashAlpha] = inside.split("/")
    const parts = main.split(/[\s,]+/).filter(Boolean)
    const alpha = slashAlpha ?? (parts.length === 4 ? parts.pop() : undefined)
    return { parts, alpha: alpha === undefined ? 1 : number(alpha.trim(), 1) }
}

// A number, or a percentage of `whole`, or NaN
const number = (value: string, whole: number) => (value.endsWith("%") ? (parseFloat(value) / 100) * whole : parseFloat(value))

const angle = (value: string) => {
    const amount = parseFloat(value)
    if (value.endsWith("turn")) return amount * 360
    if (value.endsWith("rad")) return (amount * 180) / Math.PI
    return amount
}

// A CSS color value as red, green, blue (0-255) and alpha (0-1), or null when it isn't one this can
// read (currentColor, var(), color-mix() and the like)
export const parseColor = (value: string): Rgba | null => {
    const text = value.trim().toLowerCase()
    if (!text) return null
    if (text === "transparent") return TRANSPARENT
    if (text.startsWith("#")) return fromHex(text)
    if (NAMED[text]) return fromHex(NAMED[text])
    const call = /^(rgba?|hsla?|oklch)\(([^()]*)\)$/.exec(text)
    if (!call) return null
    const { parts, alpha } = functionArguments(call[2])
    if (parts.length !== 3 || !Number.isFinite(alpha)) return null
    if (call[1].startsWith("rgb")) {
        const [r, g, b] = parts.map((part) => number(part, 255))
        return [r, g, b].every(Number.isFinite) ? rgba(Math.round(r), Math.round(g), Math.round(b), alpha) : null
    }
    if (call[1].startsWith("hsl")) {
        const [h, s, l] = [angle(parts[0]), number(parts[1], 1), number(parts[2], 1)]
        // hsl(210 40% 98%) gives percentages, which number() makes fractions of 1
        return [h, s, l].every(Number.isFinite) ? hslToRgb(h, parts[1].endsWith("%") ? s : s / 100, parts[2].endsWith("%") ? l : l / 100, alpha) : null
    }
    const [l, c, h] = [number(parts[0], 1), number(parts[1], 0.4), angle(parts[2])]
    return [l, c, h].every(Number.isFinite) ? oklchToRgb(l, c, h, alpha) : null
}

// Every literal color in a CSS value ("1px solid #E2E8F0", "linear-gradient(#fff, rgb(0 0 0 / 5%))"),
// with the text it was written as
export const colorsIn = (value: string): { text: string; color: Rgba }[] => {
    const found: { text: string; color: Rgba }[] = []
    // A variable's name (var(--brand-red)) and an address (url(#fade)) aren't colors
    const literal = value.replace(/\b(?:var|url)\([^()]*\)/gi, " ")
    for (const match of literal.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^()]*\)|\b[a-z]+\b/gi)) {
        const text = match[0]
        if (/^[a-z]+$/i.test(text) && !NAMED[text.toLowerCase()]) continue
        const color = parseColor(text)
        if (color) found.push({ text, color })
    }
    return found
}

// --- Tailwind ----------------------------------------------------------------------------------

export const TAILWIND_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const

// Tailwind 4's default palette as tailwindcss/theme.css writes it, oklch(L C H) for each shade from 50
// to 950. design-colors.test.ts checks it against the installed theme.css, so an upgrade that changes
// a color fails there.
export const TAILWIND_PALETTE: Record<string, readonly string[]> = {
    red: ["97.1% 0.013 17.38", "93.6% 0.032 17.717", "88.5% 0.062 18.334", "80.8% 0.114 19.571", "70.4% 0.191 22.216", "63.7% 0.237 25.331", "57.7% 0.245 27.325", "50.5% 0.213 27.518", "44.4% 0.177 26.899", "39.6% 0.141 25.723", "25.8% 0.092 26.042"],
    orange: ["98% 0.016 73.684", "95.4% 0.038 75.164", "90.1% 0.076 70.697", "83.7% 0.128 66.29", "75% 0.183 55.934", "70.5% 0.213 47.604", "64.6% 0.222 41.116", "55.3% 0.195 38.402", "47% 0.157 37.304", "40.8% 0.123 38.172", "26.6% 0.079 36.259"],
    amber: ["98.7% 0.022 95.277", "96.2% 0.059 95.617", "92.4% 0.12 95.746", "87.9% 0.169 91.605", "82.8% 0.189 84.429", "76.9% 0.188 70.08", "66.6% 0.179 58.318", "55.5% 0.163 48.998", "47.3% 0.137 46.201", "41.4% 0.112 45.904", "27.9% 0.077 45.635"],
    yellow: ["98.7% 0.026 102.212", "97.3% 0.071 103.193", "94.5% 0.129 101.54", "90.5% 0.182 98.111", "85.2% 0.199 91.936", "79.5% 0.184 86.047", "68.1% 0.162 75.834", "55.4% 0.135 66.442", "47.6% 0.114 61.907", "42.1% 0.095 57.708", "28.6% 0.066 53.813"],
    lime: ["98.6% 0.031 120.757", "96.7% 0.067 122.328", "93.8% 0.127 124.321", "89.7% 0.196 126.665", "84.1% 0.238 128.85", "76.8% 0.233 130.85", "64.8% 0.2 131.684", "53.2% 0.157 131.589", "45.3% 0.124 130.933", "40.5% 0.101 131.063", "27.4% 0.072 132.109"],
    green: ["98.2% 0.018 155.826", "96.2% 0.044 156.743", "92.5% 0.084 155.995", "87.1% 0.15 154.449", "79.2% 0.209 151.711", "72.3% 0.219 149.579", "62.7% 0.194 149.214", "52.7% 0.154 150.069", "44.8% 0.119 151.328", "39.3% 0.095 152.535", "26.6% 0.065 152.934"],
    emerald: ["97.9% 0.021 166.113", "95% 0.052 163.051", "90.5% 0.093 164.15", "84.5% 0.143 164.978", "76.5% 0.177 163.223", "69.6% 0.17 162.48", "59.6% 0.145 163.225", "50.8% 0.118 165.612", "43.2% 0.095 166.913", "37.8% 0.077 168.94", "26.2% 0.051 172.552"],
    teal: ["98.4% 0.014 180.72", "95.3% 0.051 180.801", "91% 0.096 180.426", "85.5% 0.138 181.071", "77.7% 0.152 181.912", "70.4% 0.14 182.503", "60% 0.118 184.704", "51.1% 0.096 186.391", "43.7% 0.078 188.216", "38.6% 0.063 188.416", "27.7% 0.046 192.524"],
    cyan: ["98.4% 0.019 200.873", "95.6% 0.045 203.388", "91.7% 0.08 205.041", "86.5% 0.127 207.078", "78.9% 0.154 211.53", "71.5% 0.143 215.221", "60.9% 0.126 221.723", "52% 0.105 223.128", "45% 0.085 224.283", "39.8% 0.07 227.392", "30.2% 0.056 229.695"],
    sky: ["97.7% 0.013 236.62", "95.1% 0.026 236.824", "90.1% 0.058 230.902", "82.8% 0.111 230.318", "74.6% 0.16 232.661", "68.5% 0.169 237.323", "58.8% 0.158 241.966", "50% 0.134 242.749", "44.3% 0.11 240.79", "39.1% 0.09 240.876", "29.3% 0.066 243.157"],
    blue: ["97% 0.014 254.604", "93.2% 0.032 255.585", "88.2% 0.059 254.128", "80.9% 0.105 251.813", "70.7% 0.165 254.624", "62.3% 0.214 259.815", "54.6% 0.245 262.881", "48.8% 0.243 264.376", "42.4% 0.199 265.638", "37.9% 0.146 265.522", "28.2% 0.091 267.935"],
    indigo: ["96.2% 0.018 272.314", "93% 0.034 272.788", "87% 0.065 274.039", "78.5% 0.115 274.713", "67.3% 0.182 276.935", "58.5% 0.233 277.117", "51.1% 0.262 276.966", "45.7% 0.24 277.023", "39.8% 0.195 277.366", "35.9% 0.144 278.697", "25.7% 0.09 281.288"],
    violet: ["96.9% 0.016 293.756", "94.3% 0.029 294.588", "89.4% 0.057 293.283", "81.1% 0.111 293.571", "70.2% 0.183 293.541", "60.6% 0.25 292.717", "54.1% 0.281 293.009", "49.1% 0.27 292.581", "43.2% 0.232 292.759", "38% 0.189 293.745", "28.3% 0.141 291.089"],
    purple: ["97.7% 0.014 308.299", "94.6% 0.033 307.174", "90.2% 0.063 306.703", "82.7% 0.119 306.383", "71.4% 0.203 305.504", "62.7% 0.265 303.9", "55.8% 0.288 302.321", "49.6% 0.265 301.924", "43.8% 0.218 303.724", "38.1% 0.176 304.987", "29.1% 0.149 302.717"],
    fuchsia: ["97.7% 0.017 320.058", "95.2% 0.037 318.852", "90.3% 0.076 319.62", "83.3% 0.145 321.434", "74% 0.238 322.16", "66.7% 0.295 322.15", "59.1% 0.293 322.896", "51.8% 0.253 323.949", "45.2% 0.211 324.591", "40.1% 0.17 325.612", "29.3% 0.136 325.661"],
    pink: ["97.1% 0.014 343.198", "94.8% 0.028 342.258", "89.9% 0.061 343.231", "82.3% 0.12 346.018", "71.8% 0.202 349.761", "65.6% 0.241 354.308", "59.2% 0.249 0.584", "52.5% 0.223 3.958", "45.9% 0.187 3.815", "40.8% 0.153 2.432", "28.4% 0.109 3.907"],
    rose: ["96.9% 0.015 12.422", "94.1% 0.03 12.58", "89.2% 0.058 10.001", "81% 0.117 11.638", "71.2% 0.194 13.428", "64.5% 0.246 16.439", "58.6% 0.253 17.585", "51.4% 0.222 16.935", "45.5% 0.188 13.697", "41% 0.159 10.272", "27.1% 0.105 12.094"],
    slate: ["98.4% 0.003 247.858", "96.8% 0.007 247.896", "92.9% 0.013 255.508", "86.9% 0.022 252.894", "70.4% 0.04 256.788", "55.4% 0.046 257.417", "44.6% 0.043 257.281", "37.2% 0.044 257.287", "27.9% 0.041 260.031", "20.8% 0.042 265.755", "12.9% 0.042 264.695"],
    gray: ["98.5% 0.002 247.839", "96.7% 0.003 264.542", "92.8% 0.006 264.531", "87.2% 0.01 258.338", "70.7% 0.022 261.325", "55.1% 0.027 264.364", "44.6% 0.03 256.802", "37.3% 0.034 259.733", "27.8% 0.033 256.848", "21% 0.034 264.665", "13% 0.028 261.692"],
    zinc: ["98.5% 0 0", "96.7% 0.001 286.375", "92% 0.004 286.32", "87.1% 0.006 286.286", "70.5% 0.015 286.067", "55.2% 0.016 285.938", "44.2% 0.017 285.786", "37% 0.013 285.805", "27.4% 0.006 286.033", "21% 0.006 285.885", "14.1% 0.005 285.823"],
    neutral: ["98.5% 0 0", "97% 0 0", "92.2% 0 0", "87% 0 0", "70.8% 0 0", "55.6% 0 0", "43.9% 0 0", "37.1% 0 0", "26.9% 0 0", "20.5% 0 0", "14.5% 0 0"],
    stone: ["98.5% 0.001 106.423", "97% 0.001 106.424", "92.3% 0.003 48.717", "86.9% 0.005 56.366", "70.9% 0.01 56.259", "55.3% 0.013 58.071", "44.4% 0.011 73.639", "37.4% 0.01 67.558", "26.8% 0.007 34.298", "21.6% 0.006 56.043", "14.7% 0.004 49.25"],
}

// Linea's theme colors in a design's frame: globals.css's .dark values, by the name Tailwind gives
// their classes (bg-primary, text-muted-foreground). They're the app's colors, never a design's.
export const LINEA_THEME_COLORS: Record<string, string> = {
    background: "oklch(0.145 0 0)",
    foreground: "oklch(0.985 0 0)",
    card: "oklch(0.205 0 0)",
    "card-foreground": "oklch(0.985 0 0)",
    popover: "oklch(0.205 0 0)",
    "popover-foreground": "oklch(0.985 0 0)",
    primary: "oklch(0.922 0 0)",
    "primary-foreground": "oklch(0.205 0 0)",
    secondary: "oklch(0.269 0 0)",
    "secondary-foreground": "oklch(0.985 0 0)",
    muted: "oklch(0.269 0 0)",
    "muted-foreground": "oklch(0.708 0 0)",
    accent: "oklch(0.269 0 0)",
    "accent-foreground": "oklch(0.985 0 0)",
    destructive: "oklch(0.704 0.191 22.216)",
    border: "oklch(1 0 0 / 10%)",
    input: "oklch(1 0 0 / 15%)",
    ring: "oklch(0.556 0 0)",
    "chart-1": "oklch(0.488 0.243 264.376)",
    "chart-2": "oklch(0.696 0.17 162.48)",
    "chart-3": "oklch(0.769 0.188 70.08)",
    "chart-4": "oklch(0.627 0.265 303.9)",
    "chart-5": "oklch(0.645 0.246 16.439)",
    sidebar: "oklch(0.205 0 0)",
    "sidebar-foreground": "oklch(0.985 0 0)",
    "sidebar-primary": "oklch(0.488 0.243 264.376)",
    "sidebar-primary-foreground": "oklch(0.985 0 0)",
    "sidebar-accent": "oklch(0.269 0 0)",
    "sidebar-accent-foreground": "oklch(0.985 0 0)",
    "sidebar-border": "oklch(1 0 0 / 10%)",
    "sidebar-ring": "oklch(0.556 0 0)",
    brass: "oklch(0.78 0.075 70)",
}

// What a design with no colors of its own shows: the frame's body text is the app's foreground, and
// behind the frame is the canvas (the app's background) under the design shape's 5% white wash
export const FRAME_TEXT = parseColor(LINEA_THEME_COLORS.foreground)!
export const FRAME_BACKDROP = over(rgba(255, 255, 255, 0.05), parseColor(LINEA_THEME_COLORS.background)!)

// A Tailwind color name ("red-500", "white", "primary-foreground", "[#0F766E]", "(--brand)"), with
// an optional /opacity ("white/80", "black/[0.35]"). `variable` resolves var() names. Returns the
// color, whether it's one of Linea's own theme colors, or null when the name isn't a color.
export const tailwindColor = (name: string, variable: (name: string) => string | null = () => null): { color: Rgba; theme: boolean } | null => {
    // The opacity's slash is the last one outside brackets: [rgb(0_0_0/0.5)] has none
    let slash = -1
    for (let at = 0, depth = 0; at < name.length; at++) {
        if (name[at] === "[" || name[at] === "(") depth++
        else if (name[at] === "]" || name[at] === ")") depth--
        else if (name[at] === "/" && depth === 0) slash = at
    }
    const [base, opacityText] = slash > 0 ? [name.slice(0, slash), name.slice(slash + 1)] : [name, null]
    const opacity = opacityText === null ? 1 : opacityText.startsWith("[") ? parseFloat(opacityText.slice(1, -1)) * (opacityText.includes("%") ? 0.01 : 1) : Number(opacityText) / 100
    if (!Number.isFinite(opacity)) return null
    const withOpacity = (color: Rgba | null, theme = false) => (color ? { color: { ...color, a: color.a * clamp01(opacity) }, theme } : null)

    if (base === "white") return withOpacity(rgba(255, 255, 255))
    if (base === "black") return withOpacity(rgba(0, 0, 0))
    if (base === "transparent") return withOpacity(TRANSPARENT)
    const shade = /^([a-z]+)-(\d{2,3})$/.exec(base)
    if (shade && TAILWIND_PALETTE[shade[1]]) {
        const index = TAILWIND_SHADES.indexOf(shade[2] as (typeof TAILWIND_SHADES)[number])
        return index === -1 ? null : withOpacity(parseColor(`oklch(${TAILWIND_PALETTE[shade[1]][index]})`))
    }
    if (LINEA_THEME_COLORS[base]) return withOpacity(parseColor(LINEA_THEME_COLORS[base]), true)
    // Arbitrary values: [#0F766E], [rgb(15_118_110)], [color:var(--x)], [var(--x)], and v4's (--x)
    const arbitrary = /^\[(?:color:)?(.+)\]$/.exec(base)?.[1]?.replace(/_/g, " ") ?? (/^\((--[\w-]+)\)$/.exec(base) ? `var(${base.slice(1, -1)})` : null)
    if (arbitrary === null) return null
    const variableName = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(arbitrary.trim())
    const value = variableName ? variable(variableName[1]) ?? variableName[2] ?? null : arbitrary
    return value === null ? null : withOpacity(parseColor(value))
}
