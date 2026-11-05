'use client'

import { useState } from 'react'
import Subscribe from '@/components/buttons/subscribe'
import { useSubscription } from '@/hooks/use-subscription'
import type { BillingPeriod } from '@/lib/plans'
import { cn } from '@/lib/utils'

const periods: { value: BillingPeriod; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
]

// Linea Pro's price and Subscribe. When a yearly plan is on sale, a switch picks the period, and
// checkout opens with that plan selected. Subscribers manage their plan in Polar, so they get no switch.
const PlanPrice = ({ hasYearly }: { hasYearly: boolean }) => {
    const [period, setPeriod] = useState<BillingPeriod>('monthly')
    const { isSubscribed } = useSubscription()
    const yearly = hasYearly && period === 'yearly'

    return (
        <div className='flex flex-1 flex-col items-center justify-center'>
            {hasYearly && isSubscribed !== true && (
                // Radio buttons, so the arrow keys move between the periods
                <fieldset className='mb-8 inline-flex rounded-full border border-white/[0.12] bg-white/[0.04] p-1'>
                    <legend className='sr-only'>Billing period</legend>
                    {periods.map((option) => (
                        <label
                            key={option.value}
                            className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                period === option.value
                                    ? 'border-brass/40 bg-brass/15 text-brass'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <input
                                type='radio'
                                name='billing-period'
                                value={option.value}
                                checked={period === option.value}
                                onChange={() => setPeriod(option.value)}
                                className='sr-only'
                            />
                            {option.label}
                            {option.value === 'yearly' && <span className='text-xs font-normal opacity-80'>a third off</span>}
                        </label>
                    ))}
                </fieldset>
            )}
            <span className='inline-block text-6xl font-bold'>
                <span className='text-4xl'>$</span>
                {yearly ? 120 : 15}
                <span className='text-lg font-normal text-muted-foreground'>/{yearly ? 'year' : 'month'}</span>
            </span>
            <p className='mt-2 mb-6 text-sm text-muted-foreground'>
                {yearly ? '$10 a month, billed yearly' : 'Billed monthly'}
            </p>
            <Subscribe period={yearly ? 'yearly' : 'monthly'} />
        </div>
    )
}

export default PlanPrice
