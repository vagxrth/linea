import type { ReactNode } from "react"
import Logo from "@/components/landing/logo"
import { Label } from "@/components/ui/label"

type Props = {
    title: string
    description: ReactNode
    children: ReactNode
    // A line under the form, such as the link to the other way in
    footer?: ReactNode
}

// The frame around the sign-in, sign-up, password reset and email confirmation forms. It uses the
// landing page's logo, type and colors, so going from the landing page to a form feels like one site.
const AuthShell = ({ title, description, children, footer }: Props) => (
    <div data-app-chrome className="flex min-h-svh flex-col">
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
            <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pt-6 pb-20">
            <div className="w-full max-w-sm">
                <h1 className="font-serif text-[2.75rem] leading-[1.05] tracking-[-0.015em] text-balance">{title}</h1>
                <p className="mt-3 text-[0.9375rem]/relaxed text-pretty text-muted-foreground">{description}</p>
                <div className="mt-8">{children}</div>
                {footer && <p className="mt-8 text-sm text-muted-foreground">{footer}</p>}
            </div>
        </main>
    </div>
)

// Between the Google button and the email form
export const AuthDivider = () => (
    <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        or
        <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
)

type FieldProps = {
    id: string
    label: string
    error?: string
    // Shown at the end of the label's row, like the forgotten password link
    action?: ReactNode
    children: ReactNode
}

// A label, its input and the input's error. Give the input aria-invalid and
// aria-describedby={`${id}-error`} while there's an error, so it's styled and read out with it.
export const AuthField = ({ id, label, error, action, children }: FieldProps) => (
    <div className="flex flex-col gap-2">
        <div className="flex min-h-5 items-center justify-between gap-2">
            <Label htmlFor={id}>{label}</Label>
            {action}
        </div>
        {children}
        {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
)

export default AuthShell
