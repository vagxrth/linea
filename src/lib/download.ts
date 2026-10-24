// Saving files from the canvas: frame snapshots and exported designs

// How long a downloaded file's address stays valid. The browser can start the download after the
// click returns, and revoking the address before then cancels it in Safari and Firefox, so this
// waits as long as FileSaver.js does.
const REVOKE_AFTER_MS = 40_000

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

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
    // The design is shown in its own frame, so capture that page at its own size
    const page = element.querySelector('iframe')?.contentDocument
    if (!page) throw new Error('No design frame found')
    const width = page.documentElement.clientWidth
    const height = page.documentElement.scrollHeight

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) throw new Error('Failed to get canvas context')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await captureVisualContent(ctx, page.body, width, height)

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