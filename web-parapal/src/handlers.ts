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
  rubric: { name: string; content?: string }
  selectedCriteria?: string[]
  standards?: { code: string; description: string }[]
}

// Helper to format rubric display name - prefer name, otherwise truncate content
function getRubricDisplayName(rubric: { name?: string; content?: string } | string): string {
  if (typeof rubric === 'string') {
    // If it's just a string, truncate it
    return rubric.length > 60 ? rubric.substring(0, 57) + '...' : rubric
  }
  if (rubric?.name) {
    return rubric.name
  }
  if (rubric?.content) {
    return rubric.content.length > 60 ? rubric.content.substring(0, 57) + '...' : rubric.content
  }
  return 'Custom rubric'
}

export async function sendMessage({ prompt, essayText, rubric, selectedCriteria, standards }: SendArgs) {
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
      rubric?.content ||
      'Grade on clarity, organization, grammar, and argument strength from 0-100.',
    standards: (standards || []).map((item) => ({
      StandardCode: item.code,
      Description: item.description,
    })),
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
  
  // Check if the response contains an error in the grade object (could be 200 or 500)
  if (parsed?.grade?.raw_output && parsed?.grade?.error) {
    const rawOutput = parsed.grade.raw_output
    const parsedRaw = typeof rawOutput === 'string' ? safeJson(rawOutput) : rawOutput
    
    // Format the error message with the error details
    const lines: string[] = []
    lines.push('⚠️ Grading Error')
    lines.push('')
    lines.push(`Error: ${parsed.grade.error}`)
    lines.push('')
    lines.push('Raw Output:')
    
    const reply = formatGradeResponse(parsedRaw)
    if (reply) {
      lines.push(reply)
    } else if (typeof parsedRaw === 'string') {
      lines.push(parsedRaw)
    } else {
      lines.push(JSON.stringify(parsedRaw, null, 2))
    }
    
    return {
      reply: lines.join('\n'),
      rubricUsed: getRubricDisplayName(rubric),
    }
  }
  
  // If status is 500 but we have raw_output in the grade, still try to display it
  if (!res.ok && res.status === 500 && parsed?.grade?.raw_output) {
    const rawOutput = parsed.grade.raw_output
    const parsedRaw = typeof rawOutput === 'string' ? safeJson(rawOutput) : rawOutput
    const reply = formatGradeResponse(parsedRaw) || rawOutput
    return {
      reply,
      rubricUsed: getRubricDisplayName(rubric),
    }
  }
  
  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`
    
    // Check if there's an error message in the grade object
    if (parsed?.grade?.error) {
      errorMessage += `\n\n⚠️ Error: ${parsed.grade.error}`
    }
    
    // Also include the top-level error if it exists
    if (parsed?.error) {
      errorMessage += `\n\n⚠️ Error: ${parsed.error}`
    }
    
    throw new Error(errorMessage)
  }

  const reply = formatGradeResponse(parsed) || bodyText

  return {
    reply,
    rubricUsed: getRubricDisplayName(rubric),
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
