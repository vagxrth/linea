import { cn } from '@/lib/utils'

// A dark stand-in for a project's thumbnail: a small frame sketched on the canvas, the way a new
// project starts. Used for the empty dashboard and for projects saved without a thumbnail.
const SketchThumbnail = ({ className }: { className?: string }) => (
    <div
        className={cn(
            'relative aspect-[4/3] overflow-hidden rounded-lg border bg-background',
            'bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:12px_12px]',
            className
        )}
    >
        <svg
            viewBox='0 0 160 120'
            aria-hidden
            className='absolute inset-0 size-full text-white/55'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <rect x={28} y={22} width={104} height={76} rx={5} className='fill-white/[0.04]' strokeOpacity={0.6} />
            <path d='M38 33 H122' />
            <rect x={38} y={42} width={42} height={28} rx={2} />
            <path d='M38 42 L80 70 M80 42 L38 70' strokeOpacity={0.45} />
            <path d='M88 46 H122 M88 54 H116 M88 62 H106' />
            <rect x={38} y={78} width={24} height={11} rx={5.5} />
            <path d='M70 84 H122' strokeOpacity={0.45} />
        </svg>
    </div>
)

export default SketchThumbnail
