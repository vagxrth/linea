'use client'

import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/use-subscription'
import type { BillingPeriod } from '@/lib/plans'
import { Loader2 } from 'lucide-react'
import React from 'react'

// period: the plan checkout opens with selected
const Subscribe = ({ period = 'monthly' }: { period?: BillingPeriod }) => {

    const { onSubscribe, onManage, isSubscribed, isFetching } = useSubscription()

    return (
        <Button
            type='button'
            variant='brass'
            size='xl'
            shape='pill'
            className='px-8'
            onClick={isSubscribed ? onManage : () => onSubscribe(period)}
            // Not disabled while the plan check loads: before it does, this subscribes, and someone who
            // already has a plan gets a 409 and a toast pointing to Manage plan
            disabled={isFetching}
        >
            {isFetching ? (
                <>
                    <Loader2 className='animate-spin' />
                    Redirecting...
                </>
            ) : isSubscribed ? (
                'Manage plan'
            ) : (
                'Subscribe'
            )}
        </Button>
    )
}

export default Subscribe
