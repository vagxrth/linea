'use client'

import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/use-subscription'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import React from 'react'

const Subscribe = () => {

    const { onSubscribe, isFetching } = useSubscription()

    return (
        <Button
            type='button'
            onClick={onSubscribe}
            disabled={isFetching}
            className={cn(
                'bg-white text-black border border-white/90',
                'rounded-full shadow-lg shadow-white/10',
                'hover:bg-white/90 hover:shadow-xl hover:shadow-white/15 transition-all duration-200',
                'active:bg-white/80 active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'font-semibold text-sm px-8 py-3',
            )}
        >
            {isFetching ? (
                <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Redirecting...
                </>
            ) : (
                'Buy now'
            )}
        </Button>
    )
}

export default Subscribe