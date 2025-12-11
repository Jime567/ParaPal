// Handlers for backend integration with Bedrock via API Gateway.
// Now secured so only authenticated Cognito users can query the grader.

import { fetchAuthSession } from 'aws-amplify/auth'
import { delay } from './utils'

// Full invoke URL for your API Gateway endpoint
const API_BASE_URL =
  'https://v7z7z1jjmc.execute-api.us-east-1.amazonaws.com/prod/grade'

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

  // 🔐 Get Cognito ID token so API Gateway's Cognito authorizer can validate the user
  const session = await fetchAuthSession()
  const idToken = session.tokens?.idToken?.toString()

  if (!idToken) {
    throw new Error('Not authenticated. Please sign in to grade essays.')
  }

  const payload = {
    essay_text: essayText,
    rubric:
      rubric?.name ||
      'Grade on clarity, organization, grammar, and argument strength from 1–5.',
  }

  console.log('Grading API request payload:', payload)

  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 👇 This is what API Gateway’s Cognito/JWT authorizer checks
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  })

  console.log('Grading API response:', res)

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
  // The API response structure is: { id: string, grade: { category_scores, overall_score, feedback, evidence } }
  const data = parsed?.grade ?? parsed

  if (!data || typeof data !== 'object') {
    return null
  }

  const overall = data.overall_score
  const categoryScores = data.category_scores || data.categoryScores || []
  const feedback = data.feedback || data.comments
  const evidence = Array.isArray(data.evidence) ? data.evidence : []

  const header: string[] = []
  if (overall !== undefined) {
    header.push(`[Overall: ${overall}]`)
  }

  // category_scores is an array of objects: [{ category: string, score: number }, ...]
  if (Array.isArray(categoryScores)) {
    for (const item of categoryScores) {
      if (item.category && item.score !== undefined) {
        // Shorten long category names for display
        const label = item.category.length > 50 
          ? item.category.substring(0, 47) + '...'
          : item.category
        header.push(`[${label}: ${item.score}]`)
      }
    }
  }

  const lines: string[] = []
  if (header.length) {
    lines.push(header.join(' '))
  }
  if (feedback) {
    lines.push('')
    lines.push(feedback)
  }
  
  // evidence is an array of objects: [{ quote: string, explanation: string }, ...]
  if (evidence.length) {
    lines.push('')
    lines.push('Evidence:')
    evidence.forEach((item: any) => {
      if (typeof item === 'string') {
        // Fallback for old format
        lines.push(item)
      } else if (item.quote && item.explanation) {
        // Combine quote and explanation on one line so it stays together in the UI
        lines.push(`"${item.quote}" — ${item.explanation}`)
      }
    })
  }

  return lines.length ? lines.join('\n') : null
}

export async function uploadRubricFile(file: File) {
  await delay(200)
  return { name: file.name, size: file.size }
}

export async function saveRubric<T>(rubric: T) {
  await delay(200)
  return rubric
}