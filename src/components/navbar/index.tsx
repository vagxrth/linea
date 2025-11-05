'use client'

import { useQuery } from 'convex/react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation'
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
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

    const me = useAppSelector((state) => state.profile)

    const pathname = usePathname();
    const hasCanvas = pathname.includes('canvas');
    const hasStyleGuide = pathname.includes('style-guide');

    const creditsBalance = useQuery(api.subscription.getCreditsBalance, { userId: me.id as Id<'users'> })

    const project = useQuery(
        api.projects.getProject,
        projectId ? { projectId: projectId as Id<'projects'> } : 'skip'
    )

    const tabs: TabProps[] = [
        {
            label: "Canvas",
            href: `/dashboard/${me.name}/canvas?project=${projectId}`,
            icon: <Hash className='h-4 w-4' />
        },
        {
            label: "Style Guide",
            href: `/dashboard/${me.name}/style-guide?project=${projectId}`,
            icon: <LayoutTemplate className='h-4 w-4' />
        }
    ]

    return (
        <div className='flex items-center justify-between p-6 fixed top-0 left-0 right-0 z-50'>
            <div className='flex items-center gap-4'>
                <Link href={`/dashboard/${me.name}`} className='w-16 h-16 rounded-full border-none bg-transparent flex items-center justify-center'>
                    <Image src='/images/logo.webp' alt="Linea" width={64} height={64} className='rounded-lg' />
                </Link>
                {(hasCanvas || hasStyleGuide) && (
                    <div className='lg:inline-block hidden rounded-full text-primary/60 border border-white/[0.12] backdrop-blur-xl bg-white/[0.08] px-4 py-2 text-sm saturate-150'>
                        Project / {project?.name}
                    </div>
                )}
            </div>

            {projectId && (
                <div className='lg:flex hidden items-center justify-center gap-2 absolute left-1/2 -translate-x-1/2'>
                    <div className='flex items-center gap-2 backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-full p-2 saturate-150'>
                        {tabs.map((t) => (
                            <Link
                                key={t.href}
                                href={t.href}
                                className={[
                                    'group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition',
                                    `${pathname}?project=${projectId}` === t.href
                                        ? 'bg-white/[0.12] text-white border border-white/[0.16] backdrop-blur-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] border border-transparent',
                                ].join(' ')}
                            >
                                <span
                                    className={`${pathname}?project=${projectId}` === t.href ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'}
                                >
                                    {t.icon}
                                </span>
                                <span>{t.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
            <div className='flex items-center gap-4 justify-end'>
                <span className='text-sm text-white/50'>{creditsBalance} Credits</span>
                {!hasCanvas && !hasStyleGuide && (
                    <Button
                        onClick={() => router.push(`/billing/${me.name}`)}
                        className='backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] saturate-150 rounded-full hover:bg-white/[0.12] hover:border-white/[0.16] transition-all duration-200 active:bg-white/[0.06] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/20 text-white font-medium text-sm px-4 py-2 h-auto'
                    >
                        <Coins className='h-4 w-4 mr-1' />
                        Buy Credits
                    </Button>
                )}
                {!hasCanvas && !hasStyleGuide && <CreateProject />}
                {hasCanvas && <Autosave />}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className='cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20 rounded-full'>
                            <Avatar className='size-12 ml-2'>
                                <AvatarImage src={me.image || ''}/>
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