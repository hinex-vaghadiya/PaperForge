"""
FastAPI entry point for Hinex PaperForge API.

Uses Groq Vision for OCR and WeasyPrint for PDF generation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="OCR processing and PDF generation API for Hinex PaperForge",
    version="2.0.0",
)

# CORS — allow frontend origins
origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.routers import ocr, pdf
app.include_router(ocr.router, prefix="/api/v1/ocr", tags=["OCR"])
app.include_router(pdf.router, prefix="/api/v1/pdf", tags=["PDF"])

# Check PDF engine availability
_pdf_available = False
try:
    from weasyprint import HTML
    _pdf_available = True
except ImportError:
    pass


@app.get("/health")
async def health_check():
    """Health check endpoint — also used to warm up the Space."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "2.0.0",
        "ocr_engine": "groq_vision (llama-4-scout)",
        "pdf_engine": "weasyprint" if _pdf_available else "html_fallback",
    }


@app.get("/")
async def root():
    """Root endpoint for HF Spaces UI."""
    return {"message": "PaperForge Backend API v2.0 — Powered by Groq Vision"}
