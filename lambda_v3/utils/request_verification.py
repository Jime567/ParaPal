from utils.response_helper import build_response
import json
def verify_request(event):
    """Verify the incoming request for required fields."""
    
    try:
        body = event.get("body")
    except Exception:
        return build_response(400, {"error": "Request body is missing."})
    
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            return build_response(400, {"error": "Invalid JSON in request body."})
        
    if not isinstance(body, dict):
        return build_response(400, {"error": "Request body must be a JSON object."})
    
    if "essay_text" not in body:
        return build_response(400, {"error": "Missing essay_text in request body."})
    
    if not body["essay_text"]:
        return build_response(400, {"error": "essay_text cannot be empty."})
    elif not isinstance(body["essay_text"], str):
        return build_response(400, {"error": "essay_text must be a string."})
    elif body["essay_text"].strip() == "":
        return build_response(400, {"error": "essay_text cannot be blank."})
    
    return body
