# **ParaPal MVP – Technical Architecture & Compliance Overview**

<img width="1280" height="720" alt="Parapal Architecture(1)" src="https://github.com/user-attachments/assets/e04802ac-b40c-4dc5-9c44-352972437d1f" />

## **Abstract**
ParaPal is a lightweight educational analytics web application that enables K–12 teachers to upload student essays, provide rubrics, select Common Core standards, and receive automated grades and personalized written feedback. The MVP demonstrates feasibility, speed, and safety using fully managed AWS services.

The system leverages:

- **Amazon S3 + CloudFront** for static web hosting  
- **AWS API Gateway + AWS Lambda** for backend routing and execution  
- **AWS Cognito** for secure authentication  
- **Amazon Bedrock** for LLM inference (Claude, Llama 3, etc.)

By using Bedrock's pre-built foundation models, the MVP avoids the complexity of model registries, feature stores, and ML pipelines. All essay data is processed **in memory only** and immediately discarded, enabling a FERPA-conscious rapid prototype.

---

## **Pipeline and FERPA Compliance (MVP)**
To minimize regulatory exposure, the MVP **stores no student data**. All essays are:

1. Uploaded temporarily for OCR  
2. Processed in-memory for inference  
3. Immediately discarded

This enabled the team to validate core functionality while avoiding FERPA obligations that require persistent, identifiable student records.

This document outlines the architecture, design decisions, cost estimates, and compliance roadmap.

---

## **Problem & Need Addressed**
Teachers spend significant time grading essays and aligning feedback to rubrics and standards. ParaPal addresses this by:

- Reducing grading time via automated draft feedback
- Providing consistent, explainable assessment
- Increasing teacher capacity and reducing burnout
- Offering a conversational interface for evidence-aligned feedback  
- Demonstrating reliable, secure, and low-cost rubric-based analysis

The MVP proves that rubric-aligned LLM feedback can be delivered securely and efficiently.

---

# **High-Level AWS Architecture Overview**

## **Frontend Layer**
- **Amazon S3**  
  Hosts the static React/HTML/CSS/JS application.
- **Amazon CloudFront**  
  Provides CDN caching, low-latency delivery, and HTTPS termination.

---

## **Auth Layer**
### **AWS Cognito (User Pools)**
- Fully managed registration & login  
- Provides secure JWT tokens for API Gateway  
- Supports password policies and MFA  
- Requires **no custom authentication logic**  
- Ideal for FERPA-sensitive applications

---

## **Backend Layer**
### **AWS API Gateway**
- HTTP API entry point  
- Validates Cognito tokens  
- Routes requests to Lambda functions  

### **AWS Lambda**
- Stateless backend compute  
- Performs OCR extraction  
- Generates structured prompts for inference  
- Calls Bedrock foundation models  
- Returns responses to the frontend  
- **Never persists data**

---

## **Inference Layer**
### **Amazon Bedrock**
- Offers Claude, Llama, Mistral, etc.  
- Requires no fine-tuning for the MVP  
- Provides secure, isolated inference endpoints  
- Eliminates need for GPUs, model hosting, or ML ops tooling  

---

## **Storage Layer (Moderate / Temporary)**
### **Amazon S3**
- Essays optionally uploaded **only during processing**  
- Deleted immediately after inference  
- Can be bypassed entirely using in-memory OCR  

---

# **Unique AWS Services Utilized**

## **AWS Cognito – Secure Authentication**
Key benefits:
- Strong, managed security  
- No password handling  
- JWT-based authorization for APIs  
- Reduces FERPA risk by avoiding custom auth services  

---

## **Amazon Bedrock – Foundation Model Inference**
Key benefits:
- Instant access to high-performing LLMs  
- Pay-per-request, serverless inference  
- No model hosting or pipelines needed  
- Enabled functional MVP delivery within weeks  

---

# **Why We Did NOT Use Advanced ML Tooling**

| Tool | Why It Was Not Used |
|------|----------------------|
| **Model Registry** | No custom models; using Bedrock FM endpoints |
| **Feature Store** | No structured feature engineering needed |
| **Vector DB** | No RAG; storing embeddings introduces FERPA risk |
| **Model Monitoring** | Models are third-party FMs; no custom training |

The MVP intentionally avoids these to reduce operational and compliance complexity.

---

# **Data Preparation for Inference (OCR Pipeline)**

1. User uploads PDF or image  
2. OCR extracts text  
3. Lambda loads the file into memory  
4. Prompt is constructed with:  
   - Cleaned essay text  
   - Rubric categories  
   - Selected Common Core standard  
   - Formatting instructions (JSON structure, quotes, feedback)  
5. Lambda calls Bedrock API  
6. Result is returned to frontend  
7. File and extracted text are **discarded immediately**

This ensures no FERPA-protected records remain after inference.

---

# **Why We Did Not Store Student Data (FERPA Justification)**

Storing essays, grades, or identities would trigger FERPA obligations:

- Access control & audit requirements  
- Mandatory Data Protection Agreements  
- Parent/student rights for access & deletion  
- Encryption, logging, and strict access policies  
- Compliance reviews with schools

To avoid these obligations, the MVP avoided:

- Persistent essay storage  
- Teacher-specific databases  
- Historical tracking  
- Logging sensitive text  
- Analytics requiring long-term data  

The architecture prioritizes privacy, simplicity, and regulatory safety.

---

# **Cost Estimate (MVP)**

### **Per-Teacher Estimate (1 teacher, ~30 essays/week)**  
_Assumptions: 6k input tokens, 2k output tokens per Bedrock call_

| AWS Service | Cost Estimate |
|------------|----------------|
| S3 static hosting | $0.50–$2.00 |
| CloudFront | $1.00–$5.00 |
| Cognito | ~$0 (50k MAUs free) |
| API Gateway | $1–$3 |
| Lambda | <$1 |
| **Bedrock inference** | **$4–$9** |
| **Total per teacher** | **$7–$20 per month** |

---

### **Estimated Cost for 1,000 Teachers**

| AWS Service | Cost Estimate |
|------------|----------------|
| S3 static hosting | $10–$20 |
| CloudFront | $50–$150 |
| Cognito | $25–$100 |
| API Gateway | $150–$300 |
| Lambda | $15–$50 |
| **Bedrock inference** | **$4,000–$9,000** |
| **Total** | **$4,300–$9,600 per month** |

**Most costs scale directly with Bedrock inference usage.**  
This suggests evaluating:

- Pre-provisioned Bedrock model usage, or  
- Hosting a custom model once scaling demands justify it  

---

# **Summary**
ParaPal’s MVP emphasizes simplicity, security, and FERPA-consciousness:

- Fully serverless, elastic architecture  
- No persistent student data  
- Low operational cost  
- Reliance on Cognito + Bedrock for AWS uniqueness  
- No ML pipeline engineering required  
- Easily extendable to production-ready compliance  

Because the architecture relies on synchronous serverless requests, a future production system may require **asynchronous processing** to avoid rate limits, timeouts, or throttling at scale.
