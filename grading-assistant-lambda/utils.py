import json
import re

def create_response(status_code, body, include_cors=True):
    """Create a standardized API response"""
    response = {
        'statusCode': status_code,
        'body': json.dumps(body)
    }
    
    if include_cors:
        response['headers'] = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
    
    return response

def extract_json_from_text(text):
    """Extract JSON object from text that may contain extra content"""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    else:
        raise ValueError("No JSON object found in text")