"""
Vision-based OCR using Groq's multimodal models.

Replaces PaddleOCR with Groq Vision (Llama 4 Scout) for
dramatically better accuracy on textbook photos and exam papers.
"""

import base64
import json
from groq import Groq
from app.config import get_settings


VISION_OCR_PROMPT = """You are an OCR engine for educational exam papers and textbook pages.

Your ONLY job is to extract ALL text visible in this image EXACTLY as it appears.

CRITICAL RULES:
- Extract EVERY word, number, symbol, equation, and marking visible in the image
- Preserve the EXACT spelling, grammar, punctuation — even if it contains errors
- Preserve question numbering (Q1, 1., (a), (i), etc.)
- Preserve marks notation like [2 marks], (3M), etc.
- Preserve mathematical expressions as closely as possible
- Maintain the reading order (top to bottom, left to right)
- Separate distinct questions with blank lines
- DO NOT add, remove, summarize, paraphrase, or correct ANYTHING
- DO NOT add explanations or commentary
- If text is unclear, write it as best you can see it — do NOT skip it

Output the raw extracted text only. Nothing else."""


def extract_text_from_image(image_bytes: bytes) -> dict:
    """
    Extract text from an image using Groq Vision API.
    
    Args:
        image_bytes: Raw image file bytes
        
    Returns:
        Dict with raw_text, confidence, and metadata
    """
    settings = get_settings()
    
    if not settings.groq_api_key:
        return {
            "raw_text": "",
            "confidence": 0.0,
            "error": "GROQ_API_KEY not configured",
        }

    client = Groq(api_key=settings.groq_api_key)
    
    # Encode image to base64
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    # Detect MIME type from magic bytes
    mime_type = _detect_mime(image_bytes)

    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": VISION_OCR_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{b64_image}",
                            },
                        },
                    ],
                }
            ],
            temperature=0.0,  # Zero temperature for exact extraction
            max_tokens=8192,
        )

        raw_text = completion.choices[0].message.content or ""
        raw_text = raw_text.strip()

        return {
            "raw_text": raw_text,
            "confidence": 0.95 if raw_text else 0.0,
            "engine": "groq_vision",
            "model": "llama-4-scout-17b-16e-instruct",
        }

    except Exception as e:
        print(f"Groq Vision OCR error: {e}")
        return {
            "raw_text": "",
            "confidence": 0.0,
            "error": str(e),
            "engine": "groq_vision",
        }


def _detect_mime(data: bytes) -> str:
    """Detect image MIME type from magic bytes."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if data[:2] == b'\xff\xd8':
        return "image/jpeg"
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/jpeg"  # Default fallback
