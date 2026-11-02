import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import React from 'react'

// Linea's frosted glass. The canvas toolbars use it here, and every other glass control gets it through
// the Button's glass variant, so they all look and respond the same.
export const liquidGlass = cva('border backdrop-blur-xl saturate-150', {
    variants: {
        variant: {
            default: 'bg-white/[0.08] border-white/[0.12]',
            subtle: 'backdrop-blur-lg saturate-125 bg-white/[0.05] border-white/[0.08]',
        },
        // Hover and press states, for glass that is a control rather than a panel
        interactive: {
            true: 'hover:bg-white/[0.12] hover:border-white/[0.16] active:bg-white/[0.06]',
            false: '',
        },
    },
    defaultVariants: {
        variant: 'default',
        interactive: false,
    },
})

interface LiquidGlassButtonProps {
    children: React.ReactNode
    onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void
    className?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'subtle'
    disabled?: boolean
    style?: React.CSSProperties
}

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
    children,
    onClick,
    className,
    size = 'md',
    variant = 'default',
    disabled = false,
    style
}) => {
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs rounded-lg',
        md: 'px-3 py-2 text-sm rounded-xl',
        lg: 'px-4 py-3 text-base rounded-2xl'
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={style}
            className={cn(
                'relative transition-all duration-200 ease-out whitespace-nowrap',
                'text-white/90 font-medium',
                'flex items-center gap-2',
                'pointer-events-auto cursor-pointer',

                liquidGlass({ variant, interactive: true }),
                sizeClasses[size],

                'active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent',

                disabled && 'opacity-50 cursor-not-allowed hover:bg-white/[0.08] hover:border-white/[0.12] active:scale-100',

                className
            )}
        >
            {children}
        </button>
    )
}
