import json
import boto3
from validation import validate_grading_response
from utils import extract_json_from_text

USER_MESSAGE = """RUBRIC:
{rubric}

STUDENT SUBMISSION:
{submission_text}

INSTRUCTIONS:
Provide the output in valid JSON format with exactly these keys:
- summary (string)
- grade (number between 0 and 100)

Do not include any conversational text, just the JSON.
"""

# Initialize Bedrock
bedrock = boto3.client(service_name='bedrock-runtime', region_name='us-east-1')

def grade_single_submission(submission_text, rubric):
    """Grade a single student submission using Llama 3"""
    try:
        system_prompt = "You are an expert teacher's assistant. Grade the student submission based strictly on the rubric."
        
        user_message = USER_MESSAGE.format(
            rubric=rubric,
            submission_text=submission_text
        )
        
        # Llama 3 uses a different payload format
        payload = {
            "prompt": f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{user_message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
            "max_gen_len": 1000,
            "temperature": 0.7,
            "top_p": 0.9
        }

        response = bedrock.invoke_model(
            body=json.dumps(payload),
            modelId="meta.llama3-70b-instruct-v1:0",  # Changed model
            accept='application/json',
            contentType='application/json'
        )

        response_body = json.loads(response.get('body').read())
        llm_output = response_body['generation']  # Changed from 'content'

        # Extract JSON from response
        json_string = extract_json_from_text(llm_output)
        response_data = json.loads(json_string)
        
        if not validate_grading_response(response_data):
            raise ValueError("Invalid response format from LLM")
            
        return response_data

    except Exception as e:
        print(f"Grading error: {str(e)}")
        return {
            "grade": None,
            "summary": f"Failed to grade: {str(e)}",
            "error": True
        }