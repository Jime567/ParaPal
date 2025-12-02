import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

// Vite-compatible worker import; ?url ensures the worker file is emitted.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export async function extractTextFromPdf(file: File): Promise<string> {
  const data = await file.arrayBuffer()
  const task = getDocument({ data })
  const pdf = await task.promise
  const pageTexts: string[] = []

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean)
    pageTexts.push(strings.join(' ').replace(/\s+/g, ' ').trim())
  }

  const text = pageTexts.join('\n\n').trim()
  return text
}
