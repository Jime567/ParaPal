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
  // Avoid unused warnings while keeping signature future-proof.
  void prompt
  void selectedCriteria

  const payload = {
    essay_text: essayText,
    rubric: rubric?.name || 'Grade on clarity, organization, grammar, and argument strength from 1–5.',
  }

  console.log('Grading API request payload:', payload)

  const res = await fetch('https://v7z7z1jjmc.execute-api.us-east-1.amazonaws.com/prod/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  console.log('Grading API response:', res

  )
  const bodyText = await res.text()

  const parsed = safeJson(bodyText)
  if (!res.ok) {
    throw new Error(parsed?.error || `Request failed with status ${res.status}`)
  }

  const reply = formatGradeResponse(parsed) || bodyText

  return {
    reply,
    rubricUsed: payload.rubric,
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function formatGradeResponse(parsed: any): string | null {
  const content =
    parsed?.grade?.choices?.[0]?.message?.content ??
    parsed?.message ??
    parsed?.result ??
    parsed

  if (typeof content !== 'string') return null

  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonBlock = fencedMatch ? fencedMatch[1] : content

  const data = safeJson(jsonBlock)
  if (!data || typeof data !== 'object') {
    return content.trim()
  }

  const overall = data.overall_score
  const categories = data.category_scores || data.categoryScores || {}
  const feedback = data.feedback || data.comments
  const evidence: string[] = Array.isArray(data.evidence) ? data.evidence : []

  const header: string[] = []
  if (overall !== undefined) {
    header.push(`[Overall: ${overall}]`)
  }
  const categoryKeys = Object.keys(categories)
  for (const key of categoryKeys) {
    const label = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase())
    header.push(`[${label}: ${categories[key]}]`)
  }

  const lines: string[] = []
  if (header.length) {
    lines.push(header.join(' '))
  }
  if (feedback) {
    lines.push(feedback)
  }
  if (evidence.length) {
    lines.push('') // empty line between feedback and evidence list
    evidence.forEach((item) => lines.push(item))
  }

  return lines.length ? lines.join('\n') : content.trim()
}

export async function uploadRubricFile(file: File) {
  await delay(200)
  return { name: file.name, size: file.size }
}

export async function saveRubric<T>(rubric: T) {
  await delay(200)
  return rubric
}
