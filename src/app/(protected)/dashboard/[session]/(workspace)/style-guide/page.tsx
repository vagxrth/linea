import Moodboard from '@/components/moodboard'
import { ThemeContent } from '@/components/theme'
import StyleGuideTypography from '@/components/typography'
import { TabsContent } from '@/components/ui/tabs'
import { MoodboardImagesQuery, StyleGuideQuery } from '@/convex/query.config'
import { MoodboardImage } from '@/hooks/use-styles'
import { StyleGuide } from '@/redux/api/style-guide'
import { Palette } from 'lucide-react'
import React from 'react'

type Props = {
    searchParams: Promise<{ project: string }>
}

const page = async ({ searchParams }: Props) => {

    const projectId = (await searchParams).project;
    const styleGuide = await StyleGuideQuery(projectId);

    const guide = styleGuide.styleGuide?._valueJSON as unknown as StyleGuide;

    const colorGuide = guide?.colorSections || [];
    const typographyGuide = guide?.typographySections || [];

    const moodboards = await MoodboardImagesQuery(projectId)
    const guideImages = moodboards.images._valueJSON as unknown as MoodboardImage[]

    return (
        <div>
            <TabsContent value='colors' className='space-y-6'>
                {!guideImages.length ? (
                    <div className='space-y-8'>
                        <div className='text-center py-20'>
                            <div className='w-16 h-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center'>
                                <Palette className='w-8 h-8 text-muted-foreground' />
                            </div>
                            <h3 className='text-lg font-medium text-foreground mb-2'>
                                No colors generated
                            </h3>
                            <p className='text-sm text-muted-foreground max-w-md mx-auto mb-6'>
                                Upload images to moodboard to generate colors and typography style guide.
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