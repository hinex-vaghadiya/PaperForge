"""
PDF generation endpoints.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.pdf_generator import generate_paper_pdf, get_content_type

router = APIRouter()


class PaperQuestion(BaseModel):
    question_text: str | None = None
    question_mode: str = "text"
    question_type: str = "short_answer"
    marks: int | None = None
    order: int = 0


class PaperSection(BaseModel):
    name: str
    questions: list[PaperQuestion]


class PaperGenerateRequest(BaseModel):
    title: str = "Examination"
    school_name: str = "English Pathshala"
    exam_name: str = ""
    subject: str = ""
    class_grade: str = ""
    duration_minutes: int | None = None
    max_marks: int | None = None
    total_marks: int | None = None
    instructions: str = ""
    sections: list[PaperSection]


@router.post("/generate")
async def generate_pdf(request: PaperGenerateRequest):
    """Generate exam paper and return as PDF or HTML."""
    try:
        paper_data = request.model_dump()
        paper_data["sections"] = [
            {"name": s["name"], "questions": [q for q in s["questions"]]}
            for s in paper_data["sections"]
        ]

        content = generate_paper_pdf(paper_data)
        content_type = get_content_type()

        safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in request.title)
        ext = "pdf" if "pdf" in content_type else "html"
        filename = f"{safe_title or 'Paper'}.{ext}"

        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@router.post("/preview")
async def preview_pdf(request: PaperGenerateRequest):
    """Generate and return inline for preview."""
    try:
        paper_data = request.model_dump()
        paper_data["sections"] = [
            {"name": s["name"], "questions": [q for q in s["questions"]]}
            for s in paper_data["sections"]
        ]

        content = generate_paper_pdf(paper_data)
        content_type = get_content_type()

        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": "inline"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")
