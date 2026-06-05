"""
OCR processing endpoints.

Pipeline: Image → Groq Vision OCR → Groq AI Structuring → Segmented Questions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.services.ocr_engine import extract_text_from_image
from app.services.ai_structurer import structure_ocr_text

router = APIRouter()


class OCRRequest(BaseModel):
    """Request to process a single file via OCR."""
    file_url: str
    file_type: str = "image"  # "image" or "pdf"


class OCRBatchRequest(BaseModel):
    """Request to process multiple files via OCR."""
    file_urls: list[str]


class OCRResponse(BaseModel):
    """Response from OCR processing."""
    raw_ocr_text: str
    questions: list[dict]
    confidence: float
    engine: str = "groq_vision"


async def download_file(url: str) -> bytes:
    """Download a file from a URL (typically Supabase Storage)."""
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def process_single_image(image_bytes: bytes) -> dict:
    """Run the full OCR pipeline on a single image."""
    
    # 1. Vision OCR — send image directly to Groq
    ocr_result = extract_text_from_image(image_bytes)

    if not ocr_result["raw_text"]:
        return {
            "raw_ocr_text": "",
            "questions": [],
            "confidence": 0.0,
            "engine": ocr_result.get("engine", "groq_vision"),
            "error": ocr_result.get("error", "No text extracted"),
        }

    # 2. AI Structuring — segment the raw text into questions
    questions = structure_ocr_text(ocr_result["raw_text"])

    return {
        "raw_ocr_text": ocr_result["raw_text"],
        "questions": questions,
        "confidence": ocr_result["confidence"],
        "engine": ocr_result.get("engine", "groq_vision"),
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
