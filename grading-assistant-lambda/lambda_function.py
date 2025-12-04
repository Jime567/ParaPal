import json
from validation import validate_request
from grading import grade_single_submission
from utils import create_response

def lambda_handler(event, context):
    try:
        # Parse input
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event
        
        # Validate input
        validation_errors = validate_request(body)
        if validation_errors:
            return create_response(400, {"errors": validation_errors})
        
        rubric = body['rubric']
        documents = body['documents']
        
        # Process all documents
        results = []
        for doc in documents:
            student_id = doc.get('id', 'unknown')
            text = doc.get('text', '')
            
            grading_result = grade_single_submission(text, rubric)
            
            results.append({
                "student_id": student_id,
                "grade": grading_result.get('grade'),
                "summary": grading_result.get('summary'),
                "error": grading_result.get('error', False)
            })
        
        return create_response(200, {"results": results})
    
    except json.JSONDecodeError:
        return create_response(400, {"error": "Invalid JSON in request body"})
    
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return create_response(500, {"error": "Internal server error"})