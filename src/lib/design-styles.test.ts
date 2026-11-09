import { describe, expect, it } from "vitest"
import { toHex } from "./design-colors"
import { computeStyles, drawnColors, matchesSelector, mediaApplies, parseSelector, parseStylesheet, utility } from "./design-styles"
import { elementsOf, ownText, parseHtml, textContent, type HtmlElement } from "./html-tree"

// The computed style of the element whose own text is `text`
const styled = (html: string, width = 1280) => {
    const root = parseHtml(html)
    const all = elementsOf(root)
    const css = all.filter((node) => node.tag === "style").map((node) => node.children.map((child) => (child.kind === "text" ? child.text : "")).join("")).join("\n")
    const styles = computeStyles(root, parseStylesheet(css, width), width)
    const find = (text: string) => all.find((node) => ownText(node) === text)!
    return {
        style: (text: string) => styles.get(find(text))!,
        colors: (text: string) => {
            const drawn = drawnColors(find(text), styles)
            return drawn && { text: toHex(drawn.text), surface: toHex(drawn.surface) }
        },
    }
}

describe("parseHtml", () => {
    it("reads void tags, raw <style> text, entities and comments", () => {
        const root = parseHtml('<div data-generated-ui><style>.a > b { color: red }</style><!-- note --><p>Tea &amp; cake&nbsp;&#8594;</p><img src="x" alt="a"><br>after</div>')
        const [page] = root.children as HtmlElement[]
        expect(page.children.map((child) => (child.kind === "element" ? child.tag : child.text))).toEqual(["style", "p", "img", "br", "after"])
        expect(textContent(page.children[0] as HtmlElement)).toBe(".a > b { color: red }")
        // Whitespace, a no-break space included, reads as one space
        expect(ownText(page.children[1] as HtmlElement)).toBe("Tea & cake →")
    })

    it("closes what a browser would: a <p> before a <div>, an <li> before the next, a cell before the next", () => {
        const root = parseHtml("<p>One<div>Two</div><ul><li>A<li>B</ul><table><tr><td>1<td>2</table>")
        const tags = (node: HtmlElement): unknown => [node.tag, ...node.children.filter((child): child is HtmlElement => child.kind === "element").map(tags)]
        expect(tags(root)).toEqual(["#root", ["p"], ["div"], ["ul", ["li"], ["li"]], ["table", ["tr", ["td"], ["td"]]]])
    })
})

describe("selectors", () => {
    const match = (selector: string, html: string, text: string) => {
        const node = elementsOf(parseHtml(html)).find((element) => ownText(element) === text)!
        const parsed = parseSelector(selector)
        return parsed !== null && matchesSelector(node, parsed)
    }

    it("match descendants, children, siblings, attributes and positions", () => {
        const html = '<div data-generated-ui><table><tbody><tr><td>a</td></tr><tr class="row"><td>b</td></tr></tbody></table><p id="lead">c</p><p>d</p></div>'
        expect(match("[data-generated-ui] td", html, "a")).toBe(true)
        expect(match("tr:nth-child(even) > td", html, "b")).toBe(true)
        expect(match("tr:nth-child(even) > td", html, "a")).toBe(false)
        expect(match("#lead + p", html, "d")).toBe(true)
        expect(match("p:not(#lead)", html, "d")).toBe(true)
        expect(match("p:not(#lead)", html, "c")).toBe(false)
        expect(match(".row:first-child td", html, "b")).toBe(false)
        expect(match(":is(.row, .other) td", html, "b")).toBe(true)
    })

    it("never match a state the page isn't in, or a pseudo-element", () => {
        const html = "<div><a>link</a></div>"
        expect(match("a:hover", html, "link")).toBe(false)
        expect(match("a::before", html, "link")).toBe(false)
        expect(match("a:not(:hover)", html, "link")).toBe(true)
    })
})

describe("the cascade in a design's frame", () => {
    it("lets the design's own <style> beat a Tailwind class, whatever their specificity, and inline styles beat both", () => {
        const page = styled('<div><style>.pill { color: #FFFFFF }</style><span class="pill text-slate-900">A</span><span class="pill text-slate-900" style="color: #111111">B</span></div>')
        expect(toHex(page.style("A").color!)).toBe("#FFFFFF")
        expect(toHex(page.style("B").color!)).toBe("#111111")
    })

    it("lets a background shorthand in the <style> block override a bg- class", () => {
        const page = styled('<div><style>.card { background: #FFFFFF }</style><div class="card bg-slate-900"><p>A</p></div></div>')
        expect(page.colors("A")!.surface).toBe("#FFFFFF")
    })

    it("applies sm: to 2xl: at the frame's width, dark: always (the frame is dark) and hover: never", () => {
        const html = '<div><p class="text-red-500 md:text-green-800 hover:text-blue-500">A</p><p class="text-red-500 dark:text-green-800">B</p></div>'
        expect(toHex(styled(html, 1280).style("A").color!)).toBe("#016630")
        expect(toHex(styled(html, 400).style("A").color!)).toBe("#FB2C36")
        expect(toHex(styled(html).style("B").color!)).toBe("#016630")
    })

    it("applies a media query's rules only when it holds at the frame's width", () => {
        expect(mediaApplies("(max-width: 640px)", 1280)).toBe(false)
        expect(mediaApplies("(max-width: 640px)", 400)).toBe(true)
        expect(mediaApplies("screen and (min-width: 48rem)", 1280)).toBe(true)
        expect(mediaApplies("(prefers-color-scheme: dark)", 1280)).toBe(false)
        const html = "<div><style>.t { font-size: 48px } @media (max-width: 640px) { .t { font-size: 32px } }</style><h1 class=\"t\">A</h1></div>"
        expect(styled(html, 1280).style("A").fontSize).toBe(48)
        expect(styled(html, 400).style("A").fontSize).toBe(32)
    })

    it("resolves var() through the variables set around an element", () => {
        const page = styled('<div><style>[data-generated-ui] { --ink: #343036; --paper: var(--sand); --sand: #EADED3 } .c-bg { background-color: var(--paper) } .c-fg { color: var(--ink, red) }</style><div data-generated-ui class="c-bg c-fg"><p>A</p></div></div>')
        expect(page.colors("A")).toEqual({ text: "#343036", surface: "#EADED3" })
    })

    it("inherits text color and size, and starts from the frame's light text on the dark canvas", () => {
        const page = styled('<div><p>A</p><div class="text-2xl"><span>B</span></div></div>')
        expect(page.colors("A")).toEqual({ text: "#FAFAFA", surface: "#161616" })
        expect(page.style("B").fontSize).toBe(24)
    })

    it("blends see-through text and backgrounds, and applies opacity to text and surface alike", () => {
        const page = styled('<div class="bg-white"><p class="text-black/50">A</p><div class="opacity-50 bg-black"><p class="text-white">B</p></div></div>')
        expect(page.colors("A")).toEqual({ text: "#808080", surface: "#FFFFFF" })
        expect(page.colors("B")).toEqual({ text: "#FFFFFF", surface: "#808080" })
    })

    it("can't say what's behind text on a gradient or a picture", () => {
        const page = styled('<div><div style="background: linear-gradient(#fff, #000)"><p>A</p></div><div class="bg-[url(/a.png)]"><p>B</p></div><div class="bg-gradient-to-r"><p class="bg-white">C</p></div></div>')
        expect(page.colors("A")).toBeNull()
        expect(page.colors("B")).toBeNull()
        // Its own background is what it's drawn on
        expect(page.colors("C")).not.toBeNull()
    })

    it("knows what isn't shown: hidden, sr-only, invisible, unless a breakpoint shows it", () => {
        const page = styled('<div><p class="hidden">A</p><p class="sr-only">B</p><p class="invisible">C</p><p class="hidden md:block">D</p><div hidden><p>E</p></div></div>')
        expect(["A", "B", "C", "D", "E"].map((text) => page.style(text).hidden)).toEqual([true, true, true, false, true])
    })

    it("makes table headers bold, as browsers do", () => {
        const page = styled("<table><tr><th>A</th><td>B</td></tr></table>")
        expect(page.style("A").fontWeight).toBe(700)
        expect(page.style("B").fontWeight).toBe(400)
    })
})

describe("utility", () => {
    it("reads sizes, shapes and colors from Tailwind classes", () => {
        expect(utility("aspect-[4/3]", 1280).declarations).toEqual([{ property: "aspect-ratio", value: "4/3", important: false }])
        expect(utility("aspect-video", 1280).declarations[0].value).toBe("16 / 9")
        expect(utility("h-64", 1280).declarations).toEqual([{ property: "height", value: "16rem", important: false }])
        expect(utility("min-h-[420px]", 1280).declarations).toEqual([{ property: "min-height", value: "420px", important: false }])
        expect(utility("h-full", 1280).declarations[0].value).toBe("100%")
        expect(utility("text-sm/6", 1280).declarations).toEqual([{ property: "font-size", value: "0.875rem", important: false }])
        expect(utility("font-semibold", 1280).declarations).toEqual([{ property: "font-weight", value: "600", important: false }])
        expect(utility("border-x-teal-600", 1280).colors[0]).toMatchObject({ property: "border-color", theme: false })
        expect(utility("border-2", 1280).colors).toEqual([])
        expect(utility("!text-white", 1280)).toMatchObject({ important: true, applies: true })
        expect(utility("group-hover:text-white", 1280).applies).toBe(false)
    })
})
