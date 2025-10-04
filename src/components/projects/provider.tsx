'use client'

import { fetchProjectSuccess } from '@/redux/slice/projects'
import { useAppDispatch } from '@/redux/store'
import React, { useEffect } from 'react'

type Props = {
    children: React.ReactNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialProjects: any
}

const ProjectsProvider = ({ children, initialProjects }: Props) => {

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (initialProjects?._valueJSON) {
            const projectsData = initialProjects._valueJSON
            dispatch(
                fetchProjectSuccess({
                    projects: projectsData,
                    total: projectsData.length
                })
            )
        }
    }, [initialProjects, dispatch])


    return (
        <>{children}</>
    )
}

export default ProjectsProvider