// Placeholder handlers for future backend integration.
// These keep the UI responsive while API wiring is pending.

import { delay } from './utils'

type SendArgs = {
  prompt: string
  essayText: string
  rubric: { name: string }
  selectedCriteria?: string[]
}

export async function sendMessage({ prompt, essayText, rubric, selectedCriteria }: SendArgs) {
  await delay(350)
  const criteriaList = selectedCriteria?.length ? selectedCriteria.join(', ') : 'general writing quality'
  const essaySummary = essayText ? `Essay received (${Math.min(essayText.length, 1200)} chars).` : 'No essay text provided.'
  return {
    reply: [
      `Thanks! I’ll grade using: ${criteriaList}.`,
      'Highlights:',
      '• Strengths: clear opening, on-topic details.',
      '• Next steps: tighten transitions, add one concrete example.',
      '• Score: 3 / 4 (simulated while backend is offline).',
      essaySummary,
      prompt ? `Note: your prompt "${prompt}" was received.` : '',
      `Rubric: ${rubric?.name ?? 'Default rubric'}`,
    ]
      .filter(Boolean)
      .join('\n'),
    rubricUsed: rubric?.name || 'Default rubric',
  }
}

export async function uploadRubricFile(file: File) {
  await delay(200)
  return { name: file.name, size: file.size }
}

export async function saveRubric<T>(rubric: T) {
  await delay(200)
  return rubric
}
