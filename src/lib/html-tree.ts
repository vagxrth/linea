// A design's HTML as a tree, for checking it. It reads what a model writes the way a browser would
// for the cases that come up (void tags, raw <style> text, entities, a <p> or <li> left open), without
// being a full HTML parser. The root stands for the frame's page, so `html`, `body` and `:root`
// selectors match it.

export type HtmlElement = {
    kind: "element"
    // Lowercase; ROOT for the page
    tag: string
    attributes: Map<string, string>
    classes: string[]
    children: HtmlNode[]
    parent: HtmlElement | null
}

export type HtmlText = { kind: "text"; text: string; parent: HtmlElement }

export type HtmlNode = HtmlElement | HtmlText

export const ROOT = "#root"

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"])
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp"])

// Opening one of these closes a <p> that's still open, as a browser does
const CLOSES_P = new Set([
    "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form",
    "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol", "p", "pre", "section", "table", "ul",
])

// Opening the key closes the nearest open element named in `closes`, unless one named in `stops` is
// nearer: a new <li> ends the last one, but not one in an outer list
const IMPLIED_END: Record<string, { closes: string[]; stops: string[] }> = {
    li: { closes: ["li"], stops: ["ul", "ol", "menu"] },
    dt: { closes: ["dt", "dd"], stops: ["dl"] },
    dd: { closes: ["dt", "dd"], stops: ["dl"] },
    tr: { closes: ["tr"], stops: ["table", "thead", "tbody", "tfoot"] },
    td: { closes: ["td", "th"], stops: ["tr", "table"] },
    th: { closes: ["td", "th"], stops: ["tr", "table"] },
    thead: { closes: ["thead", "tbody", "tfoot"], stops: ["table"] },
    tbody: { closes: ["thead", "tbody", "tfoot"], stops: ["table"] },
    tfoot: { closes: ["thead", "tbody", "tfoot"], stops: ["table"] },
    option: { closes: ["option"], stops: ["select", "datalist", "optgroup"] },
}

const ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘",
    rdquo: "”", ldquo: "“", times: "×", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", rarr: "→", larr: "←", uarr: "↑",
    darr: "↓", check: "✓", star: "☆", deg: "°", euro: "€", pound: "£", yen: "¥", cent: "¢", plusmn: "±", minus: "−",
}

export const decodeEntities = (text: string) =>
    text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
        if (name[0] === "#") {
            const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole
        }
        return ENTITIES[name.toLowerCase()] ?? whole
    })

const ATTRIBUTE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const element = (tag: string, attributes: Map<string, string>, parent: HtmlElement | null): HtmlElement => ({
    kind: "element",
    tag,
    attributes,
    classes: (attributes.get("class") ?? "").split(/\s+/).filter(Boolean),
    children: [],
    parent,
})

// Where the tag starting at `start` ends (its ">"), skipping quoted attribute values, or -1
const tagEnd = (html: string, start: number) => {
    let quote: string | null = null
    for (let index = start + 1; index < html.length; index++) {
        const char = html[index]
        if (quote) {
            if (char === quote) quote = null
        } else if (char === '"' || char === "'") {
            quote = char
        } else if (char === ">") {
            return index
        }
    }
    return -1
}

export const parseHtml = (html: string): HtmlElement => {
    const root = element(ROOT, new Map(), null)
    const stack: HtmlElement[] = [root]
    const current = () => stack[stack.length - 1]
    const text = (value: string) => {
        if (value) current().children.push({ kind: "text", text: decodeEntities(value), parent: current() })
    }
    // Pops up to and including the nearest open element named in `names`, unless one in `stops` is nearer
    const closeNearest = (names: string[], stops: string[]) => {
        for (let at = stack.length - 1; at > 0; at--) {
            if (names.includes(stack[at].tag)) {
                stack.length = at
                return
            }
            if (stops.includes(stack[at].tag)) return
        }
    }

    let index = 0
    while (index < html.length) {
        const open = html.indexOf("<", index)
        if (open === -1) {
            text(html.slice(index))
            break
        }
        text(html.slice(index, open))
        if (html.startsWith("<!--", open)) {
            const end = html.indexOf("-->", open + 4)
            index = end === -1 ? html.length : end + 3
            continue
        }
        const next = html[open + 1] ?? ""
        if (next === "!" || next === "?") {
            const end = html.indexOf(">", open)
            index = end === -1 ? html.length : end + 1
            continue
        }
        if (!/[a-zA-Z\/]/.test(next)) {
            text("<")
            index = open + 1
            continue
        }
        const end = tagEnd(html, open)
        if (end === -1) break
        const tag = html.slice(open, end + 1)
        index = end + 1

        if (next === "/") {
            const name = /^<\/\s*([a-zA-Z][\w:-]*)/.exec(tag)?.[1]?.toLowerCase()
            if (name) closeNearest([name], [])
            continue
        }
        const match = /^<([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)\s*>$/.exec(tag)
        if (!match) continue
        const name = match[1].toLowerCase()
        const attributes = new Map<string, string>()
        for (const attribute of match[2].matchAll(ATTRIBUTE)) {
            const key = attribute[1].toLowerCase()
            if (!attributes.has(key)) attributes.set(key, decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""))
        }

        if (CLOSES_P.has(name)) closeNearest(["p"], ["button", "table", "td", "th"])
        const implied = IMPLIED_END[name]
        if (implied) closeNearest(implied.closes, implied.stops)

        const node = element(name, attributes, current())
        current().children.push(node)
        if (RAW_TEXT.has(name)) {
            // Everything up to the closing tag is text, tags and all
            const close = html.slice(index).search(new RegExp(`</\\s*${name}\\s*>`, "i"))
            const body = close === -1 ? html.slice(index) : html.slice(index, index + close)
            if (body) node.children.push({ kind: "text", text: name === "style" || name === "script" ? body : decodeEntities(body), parent: node })
            index = close === -1 ? html.length : index + close + (/<\/\s*[\w-]+\s*>/.exec(html.slice(index + close))?.[0].length ?? 0)
            continue
        }
        if (!VOID.has(name) && match[3] !== "/") stack.push(node)
    }
    return root
}

export const isElement = (node: HtmlNode): node is HtmlElement => node.kind === "element"

// Every element in document order, the root first
export const elementsOf = (root: HtmlElement): HtmlElement[] => {
    const found: HtmlElement[] = []
    const visit = (node: HtmlElement) => {
        found.push(node)
        for (const child of node.children) if (isElement(child)) visit(child)
    }
    visit(root)
    return found
}

export const elementChildren = (node: HtmlElement) => node.children.filter(isElement)

// The text directly inside an element, not its children's
export const ownText = (node: HtmlElement) =>
    node.children.map((child) => (child.kind === "text" ? child.text : "")).join("").replace(/\s+/g, " ").trim()

export const textContent = (node: HtmlElement): string =>
    node.children.map((child) => (child.kind === "text" ? child.text : textContent(child))).join("").replace(/\s+/g, " ").trim()

// Whether the element sits inside (or is) one named in `tags`
export const isWithin = (node: HtmlElement | null, tags: Set<string>) => {
    for (let at = node; at; at = at.parent) if (tags.has(at.tag)) return true
    return false
}

const clip = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1)}…` : value)

// An element as it appears in the HTML, for a person or a model to find it: <span class="pill t-small">
export const describeElement = (node: HtmlElement) => {
    const shown = ["id", "class", ...(node.tag === "img" ? ["alt", "data-slot"] : [])]
    const attributes = shown
        .filter((name) => node.attributes.get(name))
        .map((name) => ` ${name}="${clip(node.attributes.get(name)!, name === "class" ? 80 : 50)}"`)
        .join("")
    return `<${node.tag}${attributes}>`
}

// Where an element is: the nearest id around it ("#orders-table"), or null
export const nearestId = (node: HtmlElement | null) => {
    for (let at = node; at; at = at.parent) {
        const id = at.attributes.get("id")
        if (id) return `#${id}`
    }
    return null
}

export const clipText = clip
