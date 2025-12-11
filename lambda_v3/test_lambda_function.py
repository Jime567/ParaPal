from lambda_function import lambda_handler
import json
import pdb
test_event = {
    "body": {
        "essay_text": "This is a sample essay text for grading.",
        "rubric": "Grade on clarity (25 pts), organization (25 pts), grammar (25 pts), and argument strength (25 pts) for a total of 0–100 pts.",
        "standards": [
            "1. Write arguments to support claims with logical reasoning, relevant evidence from accurate and credible sources, and provide a conclusion that follows from and supports the argument presented.",
            "2. Write informative/explanatory texts to examine a topic and convey ideas and information through the selection, organization, and analysis of relevant content, and provide a conclusion that supports the information or explanation presented.",
            "3. Write narrative texts to develop real or imagined experiences or events using effective technique, well-structured event sequences, descriptive details, and provide a logical resolution."
        ]
    }
}
result = lambda_handler(test_event, None)
if result['statusCode'] == 500:
    body = json.loads(result.get('body'))
    if 'grade' in body:
        grade = body['grade']
        if 'raw_output' in grade:
            print('try: raw_output = json.loads(grade["raw_output"])')
            pdb.set_trace()

print(result)
pdb.set_trace()