import { useAppSelector } from '@/redux/store'
import { useMutation } from 'convex/react'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { describeSaveFailure } from '@/lib/save-failure'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'

// After a failed save, the next try waits this long, doubling after each failure up to the maximum
const RETRY_FIRST_MS = 5000
const RETRY_MAX_MS = 60000
// One toast for the warning and its all-clear, so repeated failures don't stack copies
const SAVE_TOAST_ID = 'autosave'

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

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    // Failed saves in a row for the open project. While there are any, its latest changes aren't
    // saved: the warning says why, closing the tab asks first, and the save is tried again on a
    // timer when that can help, or else with the next edit.
    const failuresRef = useRef(0)
    // Why the last save failed, shown in the warning, or null while saves work
    const [failure, setFailure] = useState<string | null>(null)
    const failing = failure !== null
    // The reason the warning shows, so it's updated only when the reason changes
    const shownRef = useRef<string | null>(null)
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [retry, setRetry] = useState(0)

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
                if (failuresRef.current > 0) {
                    // Replaces the warning in place, so its description and close button are cleared too
                    toast.success('Your changes are saved', {
                        id: SAVE_TOAST_ID,
                        description: undefined,
                        closeButton: false,
                        duration: 4000,
                    })
                }
                failuresRef.current = 0
                shownRef.current = null
                if (retryRef.current) clearTimeout(retryRef.current)
                setFailure(null)
                setSaveStatus('saved')
                setTimeout(() => setSaveStatus('idle'), 2000)
            } catch (error) {
                console.error('Autosave failed:', error)
                const problem = describeSaveFailure(error)
                // Forget this state, so the next try saves it again
                lastSavedRef.current = ''
                failuresRef.current += 1
                if (problem.description !== shownRef.current) {
                    toast.error("Your changes aren't being saved", {
                        id: SAVE_TOAST_ID,
                        description: problem.description,
                        duration: Infinity,
                        // Every corner of the canvas has controls, so the warning can be closed.
                        // The navbar keeps saying "Not saved" until a save works.
                        closeButton: true,
                    })
                    shownRef.current = problem.description
                }
                setFailure(problem.description)
                setSaveStatus('idle')
                if (retryRef.current) clearTimeout(retryRef.current)
                if (problem.retry) {
                    retryRef.current = setTimeout(
                        () => setRetry((n) => n + 1),
                        Math.min(RETRY_FIRST_MS * 2 ** (failuresRef.current - 1), RETRY_MAX_MS)
                    )
                }
            }
        }, 1000)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [isReady, shapes, frameCounter, scale, translate, projectId, updateProjectSketches, retry])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    // The warning and the retries belong to the open project, so they end when another project
    // opens or the canvas closes
    useEffect(() => {
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current)
            if (failuresRef.current > 0) toast.dismiss(SAVE_TOAST_ID)
            failuresRef.current = 0
            shownRef.current = null
            setFailure(null)
        }
    }, [projectId])

    // While changes aren't saved, closing or reloading the tab asks first
    useEffect(() => {
        if (!failing) return
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            // Older browsers ask only when returnValue is set
            e.returnValue = true
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [failing])

    if (!isReady) return null

    if (failure !== null) {
        return (
            <div className='flex items-center gap-1.5 text-sm text-destructive' title={failure}>
                <AlertCircle className='w-4 h-4' />
                <span>Not saved</span>
            </div>
        )
    }

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
        default:
            return <></>
    }
}

export default Autosave
