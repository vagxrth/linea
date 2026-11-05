import { Hash } from 'lucide-react'

// Shown on an empty canvas until the first shape is started: how a sketch becomes a design. It
// takes no clicks, so drawing works right through it.
const EmptyCanvasCoach = () => (
    <div className='pointer-events-none absolute inset-0 flex items-center justify-center p-6 animate-in fade-in duration-700 motion-reduce:animate-none'>
        <div className='flex max-w-xs flex-col items-center gap-3 text-center'>
            <div aria-hidden className='mb-1 flex size-12 items-center justify-center rounded-xl border border-dashed border-white/20 text-muted-foreground'>
                <Hash className='size-5' />
            </div>
            <p className='font-serif text-2xl leading-tight text-foreground/85'>Start with a frame</p>
            <p className='text-[0.9375rem]/relaxed text-muted-foreground text-pretty'>
                Pick the frame tool <Hash aria-label='(#)' className='inline size-4 align-[-0.15em]' /> below and drag out a
                frame. Sketch your layout inside it, then choose Generate Design.
            </p>
        </div>
    </div>
)

export default EmptyCanvasCoach
