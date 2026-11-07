import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
    children: ReactNode
    className?: string
}

// A dark glass window around a screenshot of Linea: a thin bar with three dots above the picture. The
// picture area is near-black, so nothing flashes while the screenshot loads.
const WindowFrame = ({ children, className }: Props) => (
    <div
        className={cn(
            "rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-xl",
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_40px_90px_-30px_rgb(0_0_0/0.8)]",
            className
        )}
    >
        <div aria-hidden className="flex h-6 items-center gap-1.5 px-2">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
        </div>
        <div className="relative overflow-hidden rounded-[0.625rem] border border-white/[0.06] bg-[oklch(0.11_0_0)]">
            {children}
        </div>
    </div>
)

export default WindowFrame
