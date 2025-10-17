import { downloadBlob } from "@/hooks/use-canvas";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const combinedSlug = (name: string, maxLen = 80): string => {
  const base = name;
  if (!base) return 'Untitled';
  let s = base
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
  if (!s) s = 'Untitled';
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export const polylineBox = (
  points: ReadonlyArray<{ x: number; y: number }>
) => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const captureVisualContent = async (ctx: CanvasRenderingContext2D, contentDiv: HTMLElement, width: number, height: number) => {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(contentDiv, {
    width,
    height,
    backgroundColor: '#ffffff',
    pixelRatio: 1,
    cacheBust: true,
    includeQueryParams: false,
    skipAutoScale: true,
    skipFonts: true,
    filter: (node) => {
      if (node.nodeType === Node.TEXT_NODE) return true
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        return ![
          'SCRIPT',
          'STYLE',
          'BUTTON',
          'INPUT',
          'SELECT',
          'TEXTAREA',
        ].includes(element.tagName)
      }
      return true
    }
  })
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      resolve(void 0)
    }
    img.onerror = () => {
      reject(new Error('Failed to load captured image'))
    }
    img.src = dataUrl
  })
}

export const exportGeneratedUI = async (element: HTMLElement, filename: string) => {
  try {
    const rect = element.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')

    if (!ctx) throw new Error('Failed to get canvas context')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const contentDiv = element.querySelector(
      'div[style*="pointer-events: auto"]'
    ) as HTMLElement

    if (contentDiv) {
      await captureVisualContent(ctx, contentDiv, rect.width, rect.height)
    } else {
      throw new Error('No content div found')
    }

    canvas.toBlob((blob) => {
      if (blob) {
        console.log('Snapshot generated successfully', {
          size: blob.size,
          type: blob.type,
          filename
        })
        downloadBlob(blob, filename)
      } else {
        throw new Error('Failed to create blob')
      }
    }, 'image/png', 1.0)
  } catch (error) {
    console.error('Error exporting generated UI:', error)
    throw error
  }
}