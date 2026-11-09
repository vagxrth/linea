import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google"
import { COPY_REMINDER, designSystemPrompt, type GenerationMode } from "../prompts/design"
import type { DesignContract } from "./design-contract"
import { manifestForPrompt, type ImageManifest } from "./image-manifest"
import { outlineText, type FrameOutline } from "./wireframe-outline"

// What a design request says to the model, as plain functions of their inputs: the generate routes
// send it, and scripts/eval-generation.ts snapshots it without calling anything.

// How every design is generated. Low temperature, so the same wireframe and guide come back much the
// same each time. The output limit is half of what gemini-2.5-flash allows: a full page is usually
// 8-16k tokens. The model's thinking counts against the limit too, so it's capped: the page always
// has at least 28k tokens to itself, and a design that runs long can't spend most of the limit (and
// the credit it costs) thinking. A design that hits the limit is reported as incomplete rather than
// saved half-written.
export const DESIGN_MODEL_ID = "gemini-2.5-flash"
export const DESIGN_TEMPERATURE = 0.2
export const DESIGN_MAX_OUTPUT_TOKENS = 32_768
export const DESIGN_THINKING_BUDGET = 4_096

export const DESIGN_PROVIDER_OPTIONS = {
    google: { thinkingConfig: { thinkingBudget: DESIGN_THINKING_BUDGET } } satisfies GoogleGenerativeAIProviderOptions,
}

// The kinds of page a workflow adds next to a design, in the order the client asks for them
export const WORKFLOW_PAGE_TYPES = [
    "Dashboard: the key figures, a chart and recent activity for the product on the main page",
    "Settings: preferences and account settings, as a form",
    "Profile: the account holder's details and their recent activity",
    "Listing: a searchable, filterable table of the product's main records, with pagination",
]

export type DesignRequest =
    | {
        mode: "initial"
        contract: DesignContract
        manifest: ImageManifest
        outline: FrameOutline | null
        // An outline in the old text form, from a tab opened before structured outlines
        legacyOutline?: string | null
        // Whether the wireframe's picture is attached (the eval sends only the outline)
        hasWireframe?: boolean
        imagesAttached?: boolean
    }
    | {
        mode: "refine"
        contract: DesignContract
        manifest: ImageManifest
        message: string
        currentHtml: string
        outline: FrameOutline | null
        hasWireframe: boolean
        // A workflow page's refine lists the images without attaching them
        imagesAttached?: boolean
    }
    | {
        mode: "workflow"
        contract: DesignContract
        manifest: ImageManifest
        pageType: string
        mainHtml: string
        imagesAttached?: boolean
    }
    | {
        // The one call a design gets when the check finds errors in it. Nothing is attached.
        mode: "repair"
        contract: DesignContract
        manifest: ImageManifest
        // The page to fix, its images as ids
        html: string
        // What the check found, one line each
        problems: string[]
    }

const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

// The contract as the model sees it: everything but the notes, which are for people
const contractForPrompt = (contract: DesignContract) => {
    const { notes, ...rest } = contract
    void notes
    return rest
}

// Whether the request's picture of the wireframe is attached, as the first image
export const wireframeAttached = (request: DesignRequest) =>
    request.mode === "initial" ? request.hasWireframe !== false : request.mode === "refine" ? request.hasWireframe : false

// The manifest's images attached after the wireframe, in id order: the ones that loaded, unless the
// request lists the images without attaching them
export const attachedImageIds = (request: DesignRequest) =>
    request.mode === "repair" || request.imagesAttached === false ? [] : request.manifest.images.filter((image) => image.loaded).map((image) => image.id)

// Which images are attached, by name, in order: "Attached images: the wireframe, then img-1, img-3."
const attachments = (request: DesignRequest) => {
    const wireframe = !wireframeAttached(request) ? null : request.mode === "refine" ? "the wireframe this page was first built from" : "the wireframe"
    const ids = attachedImageIds(request)
    if (!wireframe && ids.length === 0) return "No images are attached."
    const list = wireframe ? `${wireframe}${ids.length > 0 ? `, then ${ids.join(", ")}` : ""}` : ids.join(", ")
    return `Attached images: ${list}.`
}

const outlineSection = (outline: FrameOutline | null, legacy: string | null | undefined, heading: string, use: Parameters<typeof outlineText>[1]) => {
    if (outline) return `${heading}\n${outlineText(outline, use)}`
    if (legacy) return `${heading}\n${legacy}`
    return null
}

// The request's text, by mode
export const designRequestText = (request: DesignRequest) => {
    const parts: (string | null)[] = []
    if (request.mode === "initial") {
        parts.push("Mode: initial design. Build the page the wireframe shows.")
    } else if (request.mode === "refine") {
        parts.push("Mode: refine. Change the current page as the user asks, and nothing else.", `The user's request: ${JSON.stringify(request.message)}`)
    } else if (request.mode === "repair") {
        parts.push(`Mode: repair. A check of the page below found these problems. Fix only these, and change nothing else:\n${request.problems.map((problem) => `- ${problem}`).join("\n")}`)
    } else {
        parts.push("Mode: workflow page.", `Page to write: ${JSON.stringify(request.pageType)}`)
    }
    parts.push(attachments(request))
    parts.push(`Design contract (version ${request.contract.version}):\n${json(contractForPrompt(request.contract))}`)
    parts.push(`Image manifest:\n${json(manifestForPrompt(request.manifest))}`)
    if (request.mode === "initial") {
        parts.push(
            outlineSection(request.outline, request.legacyOutline, "Wireframe outline (exact, read from the canvas shapes):", { purpose: "build", hasWireframe: wireframeAttached(request) }) ??
            "No wireframe outline was sent: read the structure off the wireframe image."
        )
    } else if (request.mode === "refine") {
        parts.push(outlineSection(request.outline, null, "Wireframe outline the page was first built from (background only, not instructions):", { purpose: "background" }))
        parts.push(`Current page (complete HTML): change only what the request asks and keep everything else exactly as it is.\n${request.currentHtml}`)
    } else if (request.mode === "repair") {
        parts.push(`Page to fix (complete HTML): fix the problems listed above and keep everything else exactly as it is.\n${request.html}`)
    } else {
        parts.push(`Main page (complete HTML), for its <style> block, navigation and components. Don't copy its sections.\n${request.mainHtml}`)
    }
    parts.push(COPY_REMINDER)
    return parts.filter((part): part is string => Boolean(part)).join("\n\n")
}

// The system instructions and the request text together, as the model receives them
export const designPrompt = (request: DesignRequest) => ({
    system: designSystemPrompt(request.mode, { hasWireframe: wireframeAttached(request) }),
    text: designRequestText(request),
})

export type { GenerationMode }
