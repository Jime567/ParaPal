import json


def build_response(status_code, body_dict):
    """
    Build a standardized API Gateway response.
    
    Args:
        status_code: HTTP status code
        body_dict: Dictionary to be returned as JSON body
        
    Returns:
        dict: Formatted API Gateway response
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        "body": json.dumps(body_dict)
    }

def verify_grade_obj(grade_obj):
    """
    Verify that the response grade object has the expected structure.
    Args:
        grade_obj: dict object from the BedrockService.grade_essay() method.
    Returns:
        int: status code
        grade_obj: original or modified grade_obj
    """

    if not isinstance(grade_obj, dict):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Grade response is not a JSON object."}
    if "raw_output" in grade_obj:
        return 500, grade_obj
    
    if "inferred_scale_min" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'inferred_scale_min' in grade response."}
    if not isinstance(grade_obj["inferred_scale_min"], (int, float)):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'inferred_scale_min' must be a number."}
    if "inferred_scale_max" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'inferred_scale_max' in grade response."}
    if not isinstance(grade_obj["inferred_scale_max"], (int, float)):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'inferred_scale_max' must be a number."}
    if "category_scores" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'category_scores' in grade response."}
    if not isinstance(grade_obj["category_scores"], list):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'category_scores' must be an array."}
    if "overall_score" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'overall_score' in grade response."}
    if not isinstance(grade_obj["overall_score"], (int, float)):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'overall_score' must be a number."}
    if "feedback" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'feedback' in grade response."}
    if not isinstance(grade_obj["feedback"], str):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'feedback' must be a string."}
    if "evidence" not in grade_obj:
        return 500, {"raw_output": json.dumps(grade_obj), "error": "Missing 'evidence' in grade response."}
    if not isinstance(grade_obj["evidence"], list):
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'evidence' must be an array."}
    
    category_scores = grade_obj["category_scores"]
    overall_score = grade_obj["overall_score"]
    sum_category_scores = 0
    for item in category_scores:
        if not isinstance(item, dict):
            return 500, {"raw_output": json.dumps(grade_obj), "error": "Each item in 'category_scores' must be an object."}
        if len(item) != 2:
            return 500, {"raw_output": json.dumps(grade_obj), "error": "Each item in 'category_scores' must have exactly 2 key-value pairs."}
        
        if "category" not in item or "score" not in item:
            return 500, {"raw_output": json.dumps(grade_obj), "error": "Each item in 'category_scores' must have 'category' and 'score' keys."}
        if item["category"] == "" or not isinstance(item["category"], str):
            return 500, {"raw_output": json.dumps(grade_obj), "error": "Category names in 'category_scores' must be non-empty strings."}
        if not isinstance(item["score"], (int, float)):
            return 500, {"raw_output": json.dumps(grade_obj), "error": f"Score for category '{item['category']}' must be a number."}
        sum_category_scores += item["score"]
    if (abs(sum_category_scores - overall_score) > 1e-1) and (abs(sum_category_scores/len(category_scores) - overall_score) > 1e-1): # Allows for average scoring
        return 500, {"raw_output": json.dumps(grade_obj), "error": "'overall_score' does not equal the sum of 'category_scores'."}
    
    # Not actually needed in final response. Just used for verification.
    grade_obj.pop("inferred_scale_min")
    grade_obj.pop("inferred_scale_max")

    return 200, grade_obj
    

