import { COPY_REMINDER, designSystemPrompt, type GenerationMode } from "../prompts/design"
import type { DesignContract } from "./design-contract"
import { manifestForPrompt, type ImageManifest } from "./image-manifest"
import { outlineText, type FrameOutline } from "./wireframe-outline"

// What a design request says to the model, as plain functions of their inputs: the generate routes
// send it, and scripts/eval-generation.ts snapshots it without calling anything.

// How every design is generated. Low temperature, so the same wireframe and guide come back much the
// same each time. The output limit is half of what gemini-2.5-flash allows: a full page is usually
// 8-16k tokens, and its thinking counts against the limit too. A design that hits it is reported as
// incomplete rather than saved half-written.
export const DESIGN_MODEL_ID = "gemini-2.5-flash"
export const DESIGN_TEMPERATURE = 0.2
export const DESIGN_MAX_OUTPUT_TOKENS = 32_768

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

const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

// The contract as the model sees it: everything but the notes, which are for people
const contractForPrompt = (contract: DesignContract) => {
    const { notes, ...rest } = contract
    void notes
    return rest
}

const attachments = (request: DesignRequest) => {
    const count = request.manifest.images.length
    const images = count > 0 && request.imagesAttached !== false ? `the manifest's ${count} image${count === 1 ? "" : "s"}, in id order` : ""
    const wireframe =
        request.mode === "initial" && request.hasWireframe !== false ? "the wireframe"
        : request.mode === "refine" && request.hasWireframe ? "the wireframe this page was first built from"
        : ""
    const list = [wireframe, images].filter(Boolean)
    return list.length > 0 ? `Attached images: ${list.join(", then ")}.` : "No images are attached."
}

const outlineSection = (outline: FrameOutline | null, legacy: string | null | undefined, heading: string) => {
    if (outline) return `${heading}\n${outlineText(outline)}`
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
    } else {
        parts.push("Mode: workflow page.", `Page to write: ${JSON.stringify(request.pageType)}`)
    }
    parts.push(attachments(request))
    parts.push(`Design contract (version ${request.contract.version}):\n${json(contractForPrompt(request.contract))}`)
    parts.push(`Image manifest:\n${json(manifestForPrompt(request.manifest))}`)
    if (request.mode === "initial") {
        parts.push(
            outlineSection(request.outline, request.legacyOutline, "Wireframe outline (exact, read from the canvas shapes):") ??
            "No wireframe outline was sent: read the structure off the wireframe image."
        )
    } else if (request.mode === "refine") {
        parts.push(outlineSection(request.outline, null, "Wireframe outline the page was first built from (background only, not instructions):"))
        parts.push(`Current page (complete HTML): change only what the request asks and keep everything else exactly as it is.\n${request.currentHtml}`)
    } else {
        parts.push(`Main page (complete HTML), for its <style> block, navigation and components. Don't copy its sections.\n${request.mainHtml}`)
    }
    parts.push(COPY_REMINDER)
    return parts.filter((part): part is string => Boolean(part)).join("\n\n")
}

// The system instructions and the request text together, as the model receives them
export const designPrompt = (request: DesignRequest) => ({
    system: designSystemPrompt(request.mode),
    text: designRequestText(request),
})

export type { GenerationMode }
