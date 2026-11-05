'use client'

import { useQuery } from 'convex/react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import React from 'react'
import { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { Hash, LayoutTemplate, User, Coins, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAppSelector } from '@/redux/store';
import CreateProject from '../buttons/create-project';
import Autosave from '../autosave';
import Image from 'next/image';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TabProps = {
    label: string
    href: string
    icon: React.ReactNode
}

const Navbar = () => {

    const params = useSearchParams();
    const projectId = params.get('project');
    const router = useRouter();
    const { handleSignOut } = useAuth();
    const { onManage, isSubscribed, isFetching } = useSubscription();

    const me = useAppSelector((state) => state.profile)
    // The profile is null when the signed-in pages' layout couldn't load it. The URL's name segment
    // only labels the page, so the links reuse the current one then.
    const { slug: urlSlug } = useParams<{ slug: string }>()
    const slug = me?.name ?? urlSlug

    const pathname = usePathname();
    const hasCanvas = pathname.includes('canvas');
    const hasStyleGuide = pathname.includes('style-guide');

    // undefined until the balance loads
    const creditsBalance = useQuery(api.subscription.getCreditsBalance, {})

    const project = useQuery(
        api.projects.getProject,
        projectId ? { projectId: projectId as Id<'projects'> } : 'skip'
    )

    const tabs: TabProps[] = [
        {
            label: "Canvas",
            href: `/dashboard/${slug}/canvas?project=${projectId}`,
            icon: <Hash className='h-4 w-4' />
        },
        {
            label: "Style Guide",
            href: `/dashboard/${slug}/style-guide?project=${projectId}`,
            icon: <LayoutTemplate className='h-4 w-4' />
        }
    ]

    return (
        // pointer-events-none on the bar, auto on its controls: the bar spans the top edge, and its empty
        // space was taking clicks meant for the canvas beneath, like a design's Chat button at fit
        // On phones the bar is tighter, to leave room for the Canvas / Style Guide switch.
        <div className='flex items-center justify-between gap-3 p-4 sm:p-6 fixed top-0 left-0 right-0 z-50 pointer-events-none'>
            <div className='flex items-center gap-4 pointer-events-auto'>
                <Link href={`/dashboard/${slug}`} className='size-12 sm:size-16 shrink-0 rounded-full border-none bg-transparent flex items-center justify-center'>
                    <Image src='/images/logo.webp' alt="Linea" width={64} height={64} className='size-full rounded-lg' />
                </Link>
                {(hasCanvas || hasStyleGuide) && (
                    <div className='lg:inline-block hidden rounded-full text-primary/80 border border-white/[0.12] backdrop-blur-xl bg-neutral-800/85 px-4 py-2 text-sm saturate-150'>
                        Project / {project?.name}
                    </div>
                )}
            </div>

            {projectId && (
                // Centered on wide screens. Below lg it sits between the logo and the account controls,
                // and on phones it shows only the icons. The open page is brass, Linea's accent.
                <nav aria-label='Project' className='pointer-events-auto flex items-center lg:absolute lg:left-1/2 lg:-translate-x-1/2'>
                    <div className='flex items-center gap-1 rounded-full border border-white/[0.12] bg-neutral-800/85 p-1 saturate-150 backdrop-blur-xl lg:gap-2 lg:p-2'>
                        {tabs.map((t) => {
                            const active = `${pathname}?project=${projectId}` === t.href
                            return (
                                <Link
                                    key={t.href}
                                    href={t.href}
                                    aria-label={t.label}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'group inline-flex items-center gap-2 rounded-full border px-3 py-2.5 text-sm transition sm:py-2 lg:px-4',
                                        active
                                            ? 'border-brass/40 bg-brass/15 text-brass'
                                            : 'border-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                                    )}
                                >
                                    <span className={active ? undefined : 'opacity-70 group-hover:opacity-90'}>{t.icon}</span>
                                    <span className='hidden sm:inline'>{t.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                </nav>
            )}
            <div className='flex items-center gap-3 sm:gap-4 justify-end pointer-events-auto'>
                {creditsBalance === undefined ? (
                    <Skeleton className='h-4 w-16 rounded-full' />
                ) : (
                    <span className='text-sm tabular-nums whitespace-nowrap text-muted-foreground'>
                        {creditsBalance} {creditsBalance === 1 ? 'credit' : 'credits'}
                    </span>
                )}
                {/* Subscribers manage their plan in Polar's portal; nothing shows until the check loads */}
                {!hasCanvas && !hasStyleGuide && isSubscribed !== undefined && (
                    <Button
                        variant='glass'
                        shape='pill'
                        onClick={isSubscribed ? onManage : () => router.push(`/billing/${slug}`)}
                        disabled={isFetching}
                    >
                        <Coins />
                        {/* Only the icon on phones, so credits, New project and the account menu fit */}
                        <span className='max-sm:sr-only'>{isSubscribed ? 'Manage plan' : 'Subscribe'}</span>
                    </Button>
                )}
                {!hasCanvas && !hasStyleGuide && <CreateProject compact />}
                {hasCanvas && <Autosave />}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className='cursor-pointer focus:outline-none rounded-full'>
                            <Avatar className='size-10 sm:size-12 sm:ml-2'>
                                <AvatarImage src={me?.image || ''}/>
                                <AvatarFallback>
                                    <User className='size-5 text-black' />
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className='backdrop-blur-xl bg-zinc-900/95 border border-white/[0.12] mt-2'>
                        <DropdownMenuItem 
                            onClick={handleSignOut}
                            className='cursor-pointer text-white hover:bg-white/[0.08] focus:bg-white/[0.08] flex items-center gap-2'
                        >
                            <LogOut className='h-4 w-4' />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default Navbar