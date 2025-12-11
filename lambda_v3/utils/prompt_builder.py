def build_grading_prompt(essay_text, rubric, standards):
    """
    Build a grading prompt for the LLM.
    
    Args:
        essay_text: The essay to be graded
        rubric: The grading rubric to use
        
    Returns:
        str: The formatted prompt
        str: The system prompt
    """
    return f"""
STANDARDS:
{standards}

RUBRIC:
{rubric}

STUDENT ESSAY:
\"\"\"{essay_text}\"\"\"

INSTRUCTIONS:
Return a JSON object with:
- inferred_scale_min: number (minimum possible overall score based on rubric. Use 0 if not specified)
- inferred_scale_max: number (maximum possible overall score based on rubric. Use 100 if not specified)
- category_scores: array of objects of the form {{'category': category, 'score': score}}
- overall_score: number (between inferred_scale_min and inferred_scale_max. Equals the sum of category scores)
- feedback: short paragraph for the teacher summarizing why the essay received this score
- evidence: array of objects of the form {{'quote': quote, 'explanation': explanation}}, with a direct quote from the essay and explanation of how it relates to a student's performance on a standard.

Do not include any conversational text, just the JSON.
""", "You are an expert teacher's assistant. Grade the student submission based on the rubric and standards. Respond only with the required JSON."