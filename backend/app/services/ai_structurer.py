"""
Groq AI service for structuring OCR text into segmented questions.

This service takes raw OCR text and uses an LLM to:
1. Identify ALL sections (Fill in blanks, True/False, Match, Short Answer, Long Answer, etc.)
2. Extract EVERY individual question from EVERY section
3. Classify question types
4. Extract metadata (marks, sub-questions)

STRICT RULE: AI must NOT rewrite or modify question text.
"""

import json
from groq import Groq
from app.config import get_settings

SYSTEM_PROMPT = """You are a question extraction assistant for educational exam papers.

Your job is to analyze OCR-extracted text from textbook pages and exam papers, and extract EVERY SINGLE QUESTION from ALL sections.

IMPORTANT — A typical textbook page may contain MULTIPLE sections like:
- Fill in the blanks
- State whether True or False
- Match the following
- Answer the following questions briefly (short answer)
- Answer the following questions in detail (long answer)
- Multiple choice questions
- Numerical problems
- Assertion-Reason questions

You MUST extract questions from ALL these sections. Do NOT stop after the first section. Do NOT skip any section. Do NOT merge questions.

RULES FOR EXTRACTION:
1. Each numbered item (1, 2, 3...) within a section is a SEPARATE question
2. For "Match the following" — extract the ENTIRE match table as ONE question (include all pairs)
3. For "Fill in the blanks" — each blank sentence is a SEPARATE question  
4. For "True or False" — each statement is a SEPARATE question
5. For short/long answer sections — each numbered item is a SEPARATE question
6. DO NOT rewrite, rephrase, or fix any question text — preserve it EXACTLY
7. DO NOT skip questions — extract ALL of them
8. Ignore handwritten annotations, marks written by students, page numbers

Question types (use exactly these values):
- mcq
- short_answer  
- long_answer
- numerical
- fill_blanks
- true_false
- assertion_reason
- match_following

Return a JSON object with this structure:
{
  "questions": [
    {
      "question_text": "exact text from OCR, unchanged",
      "question_type": "true_false",
      "marks": null,
      "sub_questions": []
    }
  ]
}

If marks are not explicitly mentioned next to a question, set marks to null.
If a question has sub-parts like (a), (b), (c), include them in sub_questions array.

REMEMBER: Extract ALL questions from ALL sections. I expect 15-25+ questions from a typical textbook page."""


def structure_ocr_text(raw_text: str) -> list[dict]:
    """
    Takes raw OCR text and structures it into segmented questions using Groq.
    
    Args:
        raw_text: The raw text output from Vision OCR
        
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
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Extract EVERY question from ALL sections in this text. Do not skip any section or any question:\n\n{raw_text}"},
            ],
            temperature=0.0,  # Zero for exact, deterministic extraction
            max_tokens=8192,  # Higher limit for pages with many questions
            response_format={"type": "json_object"},
        )

        response_text = completion.choices[0].message.content or "{}"
        result = json.loads(response_text)

        # Handle both {"questions": [...]} and [...] formats
        if isinstance(result, dict) and "questions" in result:
            questions = result["questions"]
        elif isinstance(result, list):
            questions = result
        else:
            questions = []

        # Validate and clean
        validated = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            if not q.get("question_text", "").strip():
                continue
            validated.append({
                "question_text": q.get("question_text", "").strip(),
                "question_type": q.get("question_type", "short_answer"),
                "marks": q.get("marks"),
                "sub_questions": q.get("sub_questions", []),
            })

        return validated

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
