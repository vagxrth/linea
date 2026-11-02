'use client'

import { MotionConfig, motion } from "motion/react"
import type { ReactNode } from "react"

// The landing page's motion settings. With reduced motion on, Motion leaves out movement and keeps
// the fades.
export const LandingMotion = ({ children }: { children: ReactNode }) => (
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
)

type Props = {
    children: ReactNode
    className?: string
    // Seconds to wait, so items revealed together arrive one after another
    delay?: number
}

// Fades a section's content in the first time it scrolls into view. Without JavaScript, the page's
// <noscript> style shows it straight away.
export const Reveal = ({ children, className, delay = 0 }: Props) => (
    <motion.div
        data-reveal
        className={className}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay }}
    >
        {children}
    </motion.div>
)
