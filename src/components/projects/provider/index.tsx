import { loadProject } from '@/redux/slice/shapes';
import { restoreViewport } from '@/redux/slice/viewport';
import { useAppDispatch } from '@/redux/store';
import React, { useEffect } from 'react'

type Props = {
    children: React.ReactNode;
    initialProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const ProjectProvider = ({ children, initialProject }: Props) => {

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (initialProject?._valueJSON?.sketchesData) {
            const projectData = initialProject._valueJSON

            dispatch(loadProject(projectData.sketchesData))

            if (projectData.viewportData) {
                dispatch(restoreViewport(projectData.viewportData))
            }
        }
    }, [dispatch, initialProject])

    return (
        <>
            {children}
        </>
    )
}

export default ProjectProvider