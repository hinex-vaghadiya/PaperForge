"""
Groq AI service for structuring OCR text into segmented questions.

This service takes raw OCR text and uses an LLM to:
1. Identify question boundaries
2. Split into individual questions
3. Classify question types
4. Extract metadata (marks, sub-questions)

STRICT RULE: AI must NOT rewrite or modify question text.
"""

import json
from groq import Groq
from app.config import get_settings

SYSTEM_PROMPT = """You are a question extraction assistant for educational exam papers.

Your job is to analyze OCR-extracted text from textbook pages and exam papers, then:
1. Identify question boundaries (Q1, Q2, Q1a, Q1b, etc.)
2. Split the text into individual questions
3. Classify each question's type
4. Extract marks if mentioned

CRITICAL RULES:
- DO NOT rewrite any question text
- DO NOT change wording, grammar, spelling, or meaning
- DO NOT fix OCR errors — preserve them exactly
- ONLY split, classify, and structure
- Return valid JSON only

Question types (use exactly these values):
- mcq
- short_answer
- long_answer
- numerical
- fill_blanks
- true_false
- assertion_reason
- match_following

Return a JSON array of objects:
[
  {
    "question_text": "exact text from OCR, unchanged",
    "question_type": "short_answer",
    "marks": 2,
    "sub_questions": []
  }
]

If marks are not mentioned, set marks to null.
If a question has sub-parts like (a), (b), (c), include them in sub_questions array with same format.
"""


def structure_ocr_text(raw_text: str) -> list[dict]:
    """
    Takes raw OCR text and structures it into segmented questions using Groq.
    
    Args:
        raw_text: The raw text output from PaddleOCR
        
    Returns:
        List of structured question dictionaries
    """
    settings = get_settings()
    
    if not settings.groq_api_key:
        return [{
            "question_text": raw_text,
            "question_type": "short_answer",
            "marks": None,
            "sub_questions": [],
        }]

    client = Groq(api_key=settings.groq_api_key)

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Extract and structure questions from this OCR text:\n\n{raw_text}"},
            ],
            temperature=0.1,  # Low temperature for consistent structured output
            max_tokens=4096,
            response_format={"type": "json_object"},
        )

        response_text = completion.choices[0].message.content or "[]"
        result = json.loads(response_text)

        # Handle both {"questions": [...]} and [...] formats
        if isinstance(result, dict) and "questions" in result:
            return result["questions"]
        if isinstance(result, list):
            return result
        
        return []

    except Exception as e:
        print(f"Groq API error: {e}")
        # Fallback: return raw text as single question
        return [{
            "question_text": raw_text,
            "question_type": "short_answer",
            "marks": None,
            "sub_questions": [],
            "error": str(e),
        }]
