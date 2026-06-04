"""
OCR processing endpoints.

Handles file processing through the pipeline:
Image → Preprocess → PaddleOCR → Groq AI Structuring → Segmented Questions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.services.preprocessor import preprocess_image, estimate_quality
from app.services.ocr_engine import extract_text
from app.services.ai_structurer import structure_ocr_text

router = APIRouter()


class OCRRequest(BaseModel):
    """Request to process a single file via OCR."""
    file_url: str
    file_type: str = "image"  # "image" or "pdf"


class OCRBatchRequest(BaseModel):
    """Request to process multiple files via OCR."""
    file_urls: list[str]


class ExtractedQuestion(BaseModel):
    """A question extracted from OCR processing."""
    question_text: str
    question_type: str = "short_answer"
    marks: int | None = None
    sub_questions: list[dict] = []


class OCRResponse(BaseModel):
    """Response from OCR processing."""
    raw_ocr_text: str
    questions: list[dict]
    confidence: float
    quality: dict = {}


async def download_file(url: str) -> bytes:
    """Download a file from a URL (typically Supabase Storage)."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def process_single_image(image_bytes: bytes) -> dict:
    """Run the full OCR pipeline on a single image."""
    # 1. Quality check
    quality = estimate_quality(image_bytes)

    # 2. Preprocess
    preprocessed = preprocess_image(image_bytes)

    # 3. OCR
    ocr_result = extract_text(preprocessed)

    if not ocr_result["raw_text"]:
        return {
            "raw_ocr_text": "",
            "questions": [],
            "confidence": 0.0,
            "quality": quality,
        }

    # 4. AI Structuring (only if confidence is decent)
    questions = []
    if ocr_result["confidence"] > 0.5:
        questions = structure_ocr_text(ocr_result["raw_text"])
    else:
        # Low confidence — return raw text as single block
        questions = [{
            "question_text": ocr_result["raw_text"],
            "question_type": "short_answer",
            "marks": None,
            "sub_questions": [],
            "low_confidence": True,
        }]

    return {
        "raw_ocr_text": ocr_result["raw_text"],
        "questions": questions,
        "confidence": ocr_result["confidence"],
        "quality": quality,
    }


@router.post("/process", response_model=OCRResponse)
async def process_file(request: OCRRequest):
    """Process a single uploaded file through the OCR pipeline."""
    try:
        image_bytes = await download_file(request.file_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not download file: {e}")

    result = await process_single_image(image_bytes)
    return result


@router.post("/process-batch")
async def process_batch(request: OCRBatchRequest):
    """Process multiple files through the OCR pipeline."""
    results = []
    for url in request.file_urls:
        try:
            image_bytes = await download_file(url)
            result = await process_single_image(image_bytes)
            result["file_url"] = url
            results.append(result)
        except Exception as e:
            results.append({
                "file_url": url,
                "raw_ocr_text": "",
                "questions": [],
                "confidence": 0.0,
                "error": str(e),
            })

    return {"results": results}
