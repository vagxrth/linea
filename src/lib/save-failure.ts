import { ConvexError } from "convex/values"
import type { SaveFailure } from "../../convex/projects"

// What the canvas says when a save fails, below "Your changes aren't being saved", and whether
// trying again on a timer can help
export interface SaveProblem {
    description: string
    retry: boolean
}

// Reasons the server gives. Trying again can't fix these, so the next try waits for the next edit,
// which can fix "too-large" by removing shapes.
const KNOWN: Record<SaveFailure, SaveProblem> = {
    "not-found": { description: "This project was deleted, so they can't be saved.", retry: false },
    "not-yours": { description: "This project belongs to another account, so they can't be saved.", retry: false },
    "signed-out": { description: "You've been signed out, so they can't be saved. Sign in again to keep working.", retry: false },
    "too-large": {
        description: "The drawing is too big to save. Delete some shapes or designs, and Linea will save it.",
        retry: false,
    },
}

// Anything else, like a server error, may pass
const UNKNOWN: SaveProblem = {
    description: "Linea keeps trying. Keep this tab open until this message goes away.",
    retry: true,
}

export const describeSaveFailure = (error: unknown): SaveProblem => {
    const data: unknown = error instanceof ConvexError ? error.data : undefined
    const code = typeof data === "object" && data !== null ? (data as { code?: unknown }).code : undefined
    return typeof code === "string" && Object.hasOwn(KNOWN, code) ? KNOWN[code as SaveFailure] : UNKNOWN
}
