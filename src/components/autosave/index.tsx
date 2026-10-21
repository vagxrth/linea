import { useAppSelector } from '@/redux/store'
import { useMutation } from 'convex/react'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'

const Autosave = () => {

    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')
    const user = useAppSelector((state) => state.profile)
    // Only the document is saved: undo history, the active tool and the selection stay in the browser
    const shapes = useAppSelector((state) => state.shapes.shapes)
    const frameCounter = useAppSelector((state) => state.shapes.frameCounter)
    const scale = useAppSelector((state) => state.viewport.scale)
    const translate = useAppSelector((state) => state.viewport.translate)

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSavedRef = useRef<string>('')

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    const updateProjectSketches = useMutation(api.projects.updateProjectSketches)

    const isReady = Boolean(projectId && user?.id)

    useEffect(() => {
        if (!isReady) return

        if (debounceRef.current) clearTimeout(debounceRef.current)

        // Turning the whole drawing into text is slow, so it happens once the changes pause rather
        // than on every change (every step of a drag)
        debounceRef.current = setTimeout(async () => {
            const sketchesData = { shapes, frameCounter }
            const viewportData = { scale, translate }
            const stateString = JSON.stringify({ sketchesData, viewportData })

            if (stateString === lastSavedRef.current) return

            lastSavedRef.current = stateString
            setSaveStatus('saving')

            try {
                await updateProjectSketches({
                    projectId: projectId as Id<'projects'>,
                    sketchesData,
                    viewportData,
                })
                setSaveStatus('saved')
                setTimeout(() => setSaveStatus('idle'), 2000)
            } catch (error) {
                console.error('Autosave failed:', error)
                setSaveStatus('error')
                setTimeout(() => setSaveStatus('idle'), 3000)
            }
        }, 1000)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [isReady, shapes, frameCounter, scale, translate, projectId, updateProjectSketches])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    if (!isReady) return null

    switch (saveStatus) {
        case 'saving':
            return (
                <div className='flex items-center'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                </div>
            )
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
