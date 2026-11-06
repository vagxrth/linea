import { describe, expect, it } from "vitest"
import { scriptPolicy } from "./script-policy"

const directives = (policy: string) =>
    Object.fromEntries(policy.split("; ").map((directive) => {
        const [name, ...sources] = directive.split(" ")
        return [name, sources]
    }))

describe("script policy", () => {
    it("runs only scripts with the nonce or from linea, plus the Vercel toolbar", () => {
        expect(directives(scriptPolicy("abc123", { development: false }))["script-src"]).toEqual(["'self'", "'nonce-abc123'", "https://vercel.live"])
    })

    it("never allows inline scripts without the nonce, or evaluated code in production", () => {
        const policy = scriptPolicy("abc123", { development: false })
        expect(policy).not.toContain("'unsafe-inline'")
        expect(policy).not.toContain("'unsafe-eval'")
    })

    it("lets the development server evaluate code", () => {
        expect(directives(scriptPolicy("abc123", { development: true }))["script-src"]).toContain("'unsafe-eval'")
    })

    it("blocks plugins and outside <base> elements, and keeps other sites from framing pages", () => {
        const policy = directives(scriptPolicy("abc123", { development: false }))
        expect(policy["object-src"]).toEqual(["'none'"])
        expect(policy["base-uri"]).toEqual(["'self'"])
        expect(policy["frame-ancestors"]).toEqual(["'self'"])
    })

    it("lets only the pitch page embed objects, and only linea's own, like its PDF", () => {
        const pitch = scriptPolicy("abc123", { pathname: "/pitch", development: false })
        expect(directives(pitch)["object-src"]).toEqual(["'self'"])
        // The rest of its policy is every other page's
        const others = scriptPolicy("abc123", { pathname: "/", development: false })
        expect(pitch.replace("object-src 'self'", "object-src 'none'")).toBe(others)
        for (const pathname of ["/", "/dashboard/someone", "/billing/someone", "/pitch/more", "/pitch.pdf", "/pitchdeck"]) {
            expect(directives(scriptPolicy("abc123", { pathname, development: false }))["object-src"]).toEqual(["'none'"])
        }
    })

    it("leaves images, styles, fonts and connections open, which designs rely on", () => {
        const policy = directives(scriptPolicy("abc123", { development: false }))
        for (const name of ["default-src", "img-src", "style-src", "font-src", "connect-src"]) {
            expect(policy[name]).toBeUndefined()
        }
    })
})
