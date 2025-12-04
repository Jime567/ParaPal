def validate_request(body):
    """Validate the incoming request body"""
    errors = []
    
    rubric = body.get('rubric', '')
    documents = body.get('documents', [])
    
    if not rubric:
        errors.append("Rubric is required")
    
    if not documents:
        errors.append("Documents list is required")
    elif not isinstance(documents, list):
        errors.append("Documents must be a list")
    
    return errors if errors else None

def validate_grading_response(response_data):
    """Validate the response data from the LLM"""
    if 'grade' not in response_data or 'summary' not in response_data:
        return False
    
    if not isinstance(response_data['grade'], (int, float)):
        return False
    if response_data['grade'] < 0 or response_data['grade'] > 100:
        return False
    if not isinstance(response_data['summary'], str):
        return False
    
    return True