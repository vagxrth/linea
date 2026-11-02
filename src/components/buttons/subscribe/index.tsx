'use client'

import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/use-subscription'
import { Loader2 } from 'lucide-react'
import React from 'react'

const Subscribe = () => {

    const { onSubscribe, onManage, isSubscribed, isFetching } = useSubscription()

    return (
        <Button
            type='button'
            size='lg'
            shape='pill'
            className='px-8'
            onClick={isSubscribed ? onManage : onSubscribe}
            disabled={isFetching || isSubscribed === undefined}
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
