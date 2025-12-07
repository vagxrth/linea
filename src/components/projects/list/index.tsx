'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useProjectCreation } from '@/hooks/use-project';
import { Plus, MoreVertical, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useAppSelector } from '@/redux/store';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ProjectsList = () => {

  const { projects, canCreate, deleteProject, renameProject } = useProjectCreation();
  const user = useAppSelector((state) => state.profile);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProjectId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingProjectId]);

  const handleStartEditing = (e: React.MouseEvent, projectId: string, currentName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProjectId(projectId);
    setEditingName(currentName);
  };

  const handleSaveRename = async () => {
    if (!editingProjectId || !editingName.trim()) {
      setEditingProjectId(null);
      setEditingName('');
      return;
    }
    
    await renameProject(editingProjectId, editingName.trim());
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleCancelEditing = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditing();
    }
  };

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
            <div key={project._id} className='group relative'>
              <Link href={`/dashboard/${user?.name}/canvas?project=${project._id}`} className='cursor-pointer block'>
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
                    {editingProjectId === project._id ? (
                      <input
                        ref={inputRef}
                        type='text'
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveRename}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className='font-medium text-foreground text-sm w-full bg-transparent border border-primary/50 rounded px-1 py-0.5 focus:outline-none focus:border-primary'
                      />
                    ) : (
                      <div className='flex items-center gap-1'>
                        <h3 className='font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors'>
                          {project.name}
                        </h3>
                        <button
                          onClick={(e) => handleStartEditing(e, project._id, project.name)}
                          className='p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all focus:outline-none'
                          title='Rename project'
                        >
                          <Pencil className='w-3 h-3 text-muted-foreground hover:text-foreground' />
                        </button>
                      </div>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
              <div className='absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.preventDefault()}
                      className='p-1.5 rounded-md hover:bg-white/10 transition-colors focus:outline-none'
                    >
                      <MoreVertical className='w-4 h-4 text-muted-foreground' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='backdrop-blur-xl bg-zinc-900/95 border border-white/[0.12]'>
                    <DropdownMenuItem
                      variant='destructive'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        deleteProject(project._id)
                      }}
                      className='cursor-pointer flex items-center gap-2'
                    >
                      <Trash2 className='w-4 h-4' />
                      <span>Delete project</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectsList