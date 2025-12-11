import json
import os
from datetime import datetime, timezone
import uuid

from services.bedrock_service import BedrockService
from services.s3_service import S3Service
from utils.response_helper import build_response, verify_grade_obj
from utils.prompt_builder import build_grading_prompt
from utils.request_verification import verify_request


def lambda_handler(event, context):
    """Main Lambda handler for essay grading."""
    print("Received event:", json.dumps(event))
    
    try:
        # Parse and validate request
        body = verify_request(event)
        if isinstance(body, dict) and "error" in body:
            return body  # Error response
        
        essay_text = body.get("essay_text")
        rubric = body.get("rubric", "Grade on clarity (25 pts), organization (25 pts), grammar (25 pts), and argument strength (25 pts) for a total of 0–100 pts.")
        standards = body.get("standards", [
            "1. Write arguments to support claims with logical reasoning, relevant evidence from accurate and credible sources, and provide a conclusion that follows from and supports the argument presented.",
            "2. Write informative/explanatory texts to examine a topic and convey ideas and information through the selection, organization, and analysis of relevant content, and provide a conclusion that supports the information or explanation presented.",
            "3. Write narrative texts to develop real or imagined experiences or events using effective technique, well-structured event sequences, descriptive details, and provide a logical resolution."
        ])
        
        # Initialize services
        try:
            region = os.environ["AWS_REGION"]
        except:
            region = "us-east-1"  # default region for local testing
        bedrock_service = BedrockService(
            
            region_name=region,
            model_id="google.gemma-3-12b-it"
        )
        
        # Generate grading
        prompt, system_prompt = build_grading_prompt(essay_text, rubric, standards)
        grade_obj = bedrock_service.grade_essay(prompt, system_prompt = system_prompt)
        response_code, grade_obj = verify_grade_obj(grade_obj)

        
        result_id = str(uuid.uuid4())
        
        final_response = build_response(response_code, {"id": result_id, "grade": grade_obj})
        return final_response
    
    except Exception as e:
        print("Error in handler:", e)
        return build_response(500, {"error": "Internal server error."})