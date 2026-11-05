'use client'

import { Button } from '@/components/ui/button'
import { useProjectCreation } from '@/hooks/use-project'
import { cn } from '@/lib/utils'
import { Loader2, PlusIcon } from 'lucide-react'
import React from 'react'

type Props = {
    // In the navigation bar: below sm only the icon shows (the label stays for screen readers), so
    // the bar fits a phone
    compact?: boolean
}

const CreateProject = ({ compact = false }: Props) => {

    const { createProject, isCreating, canCreate } = useProjectCreation();

  return (
    <Button
        variant='default'
        onClick={() => createProject()}
        disabled={!canCreate || isCreating}
        className='flex items-center gap-2 cursor-pointer rounded-full'
    >
        { isCreating ? (
            <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
            <PlusIcon className='h-4 w-4' />
        )}
        <span className={cn(compact && 'max-sm:sr-only')}>{ isCreating ? 'Creating...' : 'New project'}</span>
    </Button>
  )
}

export default CreateProject