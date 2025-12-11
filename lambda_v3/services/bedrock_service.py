import json
import boto3
import re


class BedrockService:
    """Service for interacting with AWS Bedrock."""
    
    def __init__(self, region_name, model_id):
        self.client = boto3.client("bedrock-runtime", region_name=region_name)
        self.model_id = model_id
        print(f"Initialized BedrockService with boto3 version: {boto3.__version__}")
    
    def grade_essay(self, prompt, system_prompt = "You are an expert teacher's assistant. Grade the student submission based strictly on the rubric."):
        """
        Send a grading prompt to Bedrock and return parsed grade object.
        
        Args:
            prompt: The grading prompt string
            system_prompt: The system prompt string
            
        Returns:
            dict: Parsed grade object or raw output
        """
        response = self._invoke_converse(prompt, system_prompt)
        raw_text = self._extract_response_text(response)
        
        return self._parse_grade_response(raw_text)
    
    
    def _invoke_converse(self, prompt, system_prompt):
        """
        Invoke the model using the Converse API.
        The Converse API provides a unified interface across all Bedrock models.
        
        Args:
            prompt: The user prompt
            system_prompt: system prompt
            
        Returns:
            dict: The response from Bedrock
        """
        request = {
            "modelId": self.model_id,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "maxTokens": 1024,
                "temperature": 0.3,
            }
        }
        if system_prompt:
            request["system"] = [{"text": system_prompt}]

        return self.client.converse(**request)
        
    def _extract_response_text(self, response):
        """
        Extract text from Converse API response.
        The Converse API always returns the same structure.
        
        Args:
            response: The response from converse()
            
        Returns:
            str: The extracted text response
        """
        # Converse API always has this structure:
        # response["output"]["message"]["content"][0]["text"]
        try:
            # Navigate to content array
            content = response["output"]["message"]["content"]
            
            # Extract all text blocks and join them
            # (Usually just one block, but can be multiple)
            texts = [block["text"] for block in content if "text" in block]
            return "".join(texts)
                
        except (KeyError, TypeError) as e:
            print(f"Error extracting text from response: {e}")
            print(f"Response structure: {json.dumps(response, default=str)}")
            
            # Return structured error as JSON string
            error_obj = {
                "raw_output": json.dumps(response, default=str),
                "error": "Received unexpected format from Converse API"
            }
            return json.dumps(error_obj)
    
    def _filter_non_json(self, text):
        """Extract JSON object from text that may contain extra content"""
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return match.group(0)
        else:
            raise ValueError("No JSON object found in text")
    def _parse_grade_response(self, raw_text):
        """
        Attempt to parse JSON from model output, with fallback.
        
        Args:
            raw_text: Raw text output from the model
            
        Returns:
            dict: Parsed grade object or dict with raw output
        """
        
        try:
            filtered_text = self._filter_non_json(raw_text)
            return json.loads(filtered_text) 
        except:
            return {"raw_output": raw_text, "error": "Failed to parse JSON from model output"}
        
    
problematic_json = '{\n  "inferred_scale_min": 0,\n  "inferred_scale_max": 100,\n  "category_scores": [\n    {\n      "category": "clarity",\n      "score": 5\n    },\n    {\n      "category": "organization",\n      "score": 5\n    },\n    {\n      "category": "grammar",\n      "score": 5\n    },\n    {\n      "category": "argument strength",\n      "score": 5\n    }\n  ],\n  "overall_score": 20,\n  "feedback": "The essay demonstrates a significant lack of clarity, organization, grammatical correctness, and a discernible argument. The text is extremely brief and provides no substantive content to evaluate. It appears to be a placeholder or incomplete submission.",\n  "evidence": [\n    "\\"This is a sample essay text for grading.\\"": "This single sentence provides no context, argument, or developed ideas, indicating a lack of clarity and argument strength.",\n    "\\"This is a sample essay text for grading.\\"": "The repetitive nature of this sentence highlights the absence of organization and development within the essay.",\n    "\\"This is a sample essay text for grading.\\"": "The simple sentence structure and lack of varied vocabulary suggest a need for improvement in grammar and overall clarity."\n  ]\n}'