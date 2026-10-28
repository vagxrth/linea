'use client'

import { clearAll, loadProject } from '@/redux/slice/shapes';
import { resetView, restoreViewport } from '@/redux/slice/viewport';
import { useAppDispatch } from '@/redux/store';
import React, { useLayoutEffect, useState } from 'react'

type Props = {
    children: React.ReactNode;
    initialProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const CanvasProjectProvider = ({ children, initialProject }: Props) => {

    const dispatch = useAppDispatch();
    // The store is shared by every project, so the canvas waits until this project is in it.
    // Otherwise its first frame would show the project opened before.
    const [loaded, setLoaded] = useState(false);

    // A layout effect runs before the browser paints, so the canvas first appears with this
    // project's shapes and view
    useLayoutEffect(() => {
        // Always initialize canvas state for the current project.
        // This ensures that switching projects never leaks state from a previous project.
        const projectData = initialProject

        if (projectData?.sketchesData) {
            // Restore saved shapes and viewport for existing projects
            dispatch(loadProject(projectData.sketchesData))

            if (projectData.viewportData) {
                dispatch(restoreViewport(projectData.viewportData))
            } else {
                dispatch(resetView())
            }
        } else {
            // New or empty project: clear any leftover state from previously opened projects
            dispatch(clearAll())
            dispatch(resetView())
        }
        setLoaded(true);
    }, [dispatch, initialProject])

    if (!loaded) return null

    return (
        <>
            {children}
        </>
    )
}

export default CanvasProjectProvider