import Moodboard from '@/components/moodboard'
import { ThemeContent } from '@/components/theme'
import StyleGuideTypography from '@/components/typography'
import { TabsContent } from '@/components/ui/tabs'
import { MoodboardImagesQuery, ProjectQuery, StyleGuideQuery } from '@/convex/query.config'
import { MoodboardImage } from '@/hooks/use-styles'
import { StyleGuide } from '@/redux/api/style-guide'
import { Palette } from 'lucide-react'
import React from 'react'

type Props = {
    searchParams: Promise<{ project?: string }>
}

const page = async ({ searchParams }: Props) => {

    const projectId = (await searchParams).project;

    if (!projectId) {
        return <p className='text-center py-20 text-muted-foreground'>No projects selected</p>
    }

    // Checked first, since the style guide and moodboard queries throw for a project you can't open
    const { project, profile } = await ProjectQuery(projectId)

    if (!profile) {
        return <p className='text-center py-20 text-muted-foreground'>Authentication required</p>
    }

    if (!project) {
        return <p className='text-center py-20 text-red-500'>Project not found</p>
    }

    const { styleGuide } = await StyleGuideQuery(projectId);

    const guide: StyleGuide | null = styleGuide;

    const colorGuide = guide?.colorSections || [];
    const typographyGuide = guide?.typographySections || [];

    const { images } = await MoodboardImagesQuery(projectId)
    // Saved images come without the local preview that MoodboardImage requires; the moodboard
    // shows their url instead
    const guideImages = images as unknown as MoodboardImage[]

    return (
        <div>
            <TabsContent value='colors' className='space-y-6'>
                {/* Empty until a style guide is generated. Generating needs moodboard images, so the
                    hint names the next step. */}
                {!colorGuide.length ? (
                    <div className='space-y-8'>
                        <div className='text-center py-20'>
                            <div className='w-16 h-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center'>
                                <Palette className='w-8 h-8 text-muted-foreground' />
                            </div>
                            <h3 className='text-lg font-medium text-foreground mb-2'>
                                No colors generated
                            </h3>
                            <p className='text-sm text-muted-foreground max-w-md mx-auto mb-6'>
                                {guideImages.length
                                    ? 'Click Generate Style Guide on the Moodboard tab to create colors and typography from your images.'
                                    : 'Upload images to moodboard to generate colors and typography style guide.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <ThemeContent colorGuide={colorGuide}/>
                )}
            </TabsContent>

            <TabsContent value='typography'>
                <StyleGuideTypography typographyGuide={typographyGuide} />
            </TabsContent>

            <TabsContent value='moodboard'>
                <Moodboard guideImages={guideImages} />
            </TabsContent>
        </div>
    )
}

export default page