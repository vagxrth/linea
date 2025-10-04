import React from 'react'
import { useProjectCreation } from '@/hooks/use-project';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useAppSelector } from '@/redux/store';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

const ProjectsList = () => {

  const { projects, canCreate } = useProjectCreation();
  const user = useAppSelector((state) => state.profile);

  if (!canCreate) {
    return (
      <div className='text-center py-24'>
        <p className='text-lg'>Please sign in to view your projects</p>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-semibold text-foreground'>
          Your Projects
        </h1>
        <p className='text-muted-foreground mt-2'>
          Manage your projects
        </p>
      </div>
      {projects.length === 0 ? (
        <div className='text-center py-20'>
          <div className='w-16 h-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center'>
            <Plus className='w-8 h-8 text-muted-foreground' />
          </div>
          <h3 className='text-lg font-medium text-foreground mb-2'>
            No Projects Found
          </h3>
          <p className='text-sm text-muted-foreground mb-6'>
            Create your first project
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {projects.map((project: any) => (
            <Link key={project._id} href={`/dashboard/${user?.name}/canvas?project=${project._id}`} className='group cursor-pointer'>
              <div className='space-y-3'>
                <div className='aspect-[4/3] rounded-lg overflow-hidden bg-muted'>
                  {project.thumbnail ? (
                    <Image src={project.thumbnail} alt={project.name} width={300} height={200} className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-200' />
                  ) : (
                    <div className='w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center'>
                      <Plus className='w-8 h-8 text-gray-400' />
                    </div>
                  )}
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors'>
                    {project.name}
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectsList