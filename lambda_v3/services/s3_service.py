import json
import boto3


class S3Service:
    """Service for interacting with AWS S3."""
    
    def __init__(self, bucket_name):
        self.client = boto3.client("s3")
        self.bucket_name = bucket_name
    
    def save_result(self, result_id, result_record):
        """
        Save a grading result to S3.
        
        Args:
            result_id: Unique identifier for the result
            result_record: Dictionary containing the result data
        """
        print("Saving result record:", result_record)
        
        self.client.put_object(
            Bucket=self.bucket_name,
            Key=f"results/{result_id}.json",
            Body=json.dumps(result_record).encode("utf-8"),
            ContentType="application/json"
        )