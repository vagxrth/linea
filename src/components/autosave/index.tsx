import { useAutosaveProjectMutation } from '@/redux/api/project'
import { useAppSelector } from '@/redux/store'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useRef, useState } from 'react'

const Autosave = () => {

    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')
    const user = useAppSelector((state) => state.profile)
    const shapesState = useAppSelector((state) => state.shapes)
    const viewportState = useAppSelector((state) => state.viewport)

    const abortRef = useRef<AbortController | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSavedRef = useRef<string>('')

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    const [autosaveProject, { isLoading: isSaving }] = useAutosaveProjectMutation()

    const isReady = Boolean(projectId && user?.id)

    switch (saveStatus) {
        case 'saved':
            return (
                <div className='flex items-center'>
                    <CheckCircle className='w-4 h-4' />
                </div>
            )
        case 'error':
            return (
                <div className='flex items-center'>
                    <AlertCircle className='w-4 h-4' />
                </div>
            )
        default:
            return <></>
    }
}

export default Autosave