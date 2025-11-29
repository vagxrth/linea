import InfiniteCanvas from '@/components/canvas'
import ProjectProvider from '@/components/projects/provider/index'
import { ProjectQuery } from '@/convex/query.config'
import React from 'react'

interface CanvasPageProps {
  searchParams: Promise<{ project?: string }>
}

const page = async ({ searchParams }: CanvasPageProps) => {

  const params = await searchParams
  const projectId = params.project

  if (!projectId) {
    return (
      <div className='w-full h-screen flex items-center justify-center'>
        <p className='text-muted-foreground'>No projects selected</p>
      </div>
    )
  }

  const { project, profile } = await ProjectQuery(projectId)

  if (!profile) {
    return (
      <div className='w-full h-screen flex items-center justify-center'>
        <p className='text-muted-foreground'>
          Authentication required
        </p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className='w-full h-screen flex items-center justify-center'>
        <p className='text-red-500'>
          Project not found
        </p>
      </div>
    )
  }

  return (
    <ProjectProvider key={projectId} initialProject={project}>
      <InfiniteCanvas />
    </ProjectProvider>
  )
}

export default page