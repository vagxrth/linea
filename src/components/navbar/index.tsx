'use client'

import Link from 'next/link';
import { useSearchParams } from 'next/navigation'
import React from 'react'

const Navbar = () => {

    const params = useSearchParams();
    const projectId = params.get('projectId');

    return (
        <div className='grid grid-cols-2 lg:grid-cols-3 p-6 fixed top-0 left-0 right-0 z-50'>
            <div className='flex items-center gap-4'>
                <Link href={`/dashboard`} className='w-8 h-8 rounded-full border-3 border-white bg-black flex items-center justify-center'>
                    <div className='w-4 h-4 rounded-full bg-white'></div>
                </Link>
            </div>
        </div>
    )
}

export default Navbar