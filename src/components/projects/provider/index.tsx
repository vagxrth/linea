'use client'

import { clearAll, loadProject } from '@/redux/slice/shapes';
import { resetView, restoreViewport } from '@/redux/slice/viewport';
import { useAppDispatch } from '@/redux/store';
import React, { useEffect } from 'react'

type Props = {
    children: React.ReactNode;
    initialProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const ProjectProvider = ({ children, initialProject }: Props) => {

    const dispatch = useAppDispatch();

    useEffect(() => {
        // Always initialize canvas state for the current project.
        // This ensures that switching projects never leaks state from a previous project.
        const projectData = initialProject?._valueJSON

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
    }, [dispatch, initialProject])

    return (
        <>
            {children}
        </>
    )
}

export default ProjectProvider