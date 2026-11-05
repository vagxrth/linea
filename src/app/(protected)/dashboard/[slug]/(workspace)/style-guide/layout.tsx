import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Hash, LayoutIcon, Type } from 'lucide-react'
import React from 'react'

type Props = {
    children: React.ReactNode
}

const tabs = [
    {
        value: 'colors',
        label: 'Colors',
        icon: Hash

    },
    {
        value: 'typography',
        label: 'Typography',
        icon: Type
    },
    {
        value: 'moodboard',
        label: 'Moodboard',
        icon: LayoutIcon
    },
] as const

const layout = ({ children }: Props) => {
    return (
        <Tabs defaultValue={'colors'} className='w-full'>
            <div className='mt-36 container mx-auto px-4 sm:px-6 py-6 sm:py-8'>
                <div>
                    <div className='flex flex-col lg:flex-row gap-4 lg:gap-5 items-center justify-between'>
                        <div>
                            <h1 className='font-serif text-4xl tracking-tight lg:text-left text-center text-foreground'>
                                Style Guide
                            </h1>
                            <p className='text-muted-foreground mt-2 text-center lg:text-left'>
                                Customize your style guide to match your brand.
                            </p>
                        </div>
                        <TabsList className='grid w-full sm:w-fit h-auto grid-cols-3 rounded-full backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] saturate-150 p-2'>
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    // The open tab is brass, Linea's accent. The trigger sets its own active colors
                                    // under dark:, so these do too, to take their place.
                                    <TabsTrigger key={tab.value} value={tab.value} className='flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors sm:text-sm dark:data-[state=active]:border-brass/40 dark:data-[state=active]:bg-brass/15 dark:data-[state=active]:text-brass data-[state=active]:shadow-none'>
                                        <Icon className='w-4 h-4' />
                                        {tab.label}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </div>
                </div>
            </div>
            <div className='container mx-auto px-4 sm:px-6 py-6 sm:py-8'>
                { children }
            </div>
        </Tabs>
    )
}

export default layout