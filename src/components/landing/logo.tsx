import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Props = {
    href?: string
    className?: string
}

// The logo mark with the wordmark, linking home. Used by the landing page and the sign-in pages.
const Logo = ({ href = "/", className }: Props) => (
    <Link
        href={href}
        className={cn(
            "inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            className
        )}
    >
        <Image src="/images/logo.webp" alt="" width={32} height={32} className="size-8" priority />
        <span className="font-serif text-2xl leading-none tracking-tight">Linea</span>
    </Link>
)

export default Logo
