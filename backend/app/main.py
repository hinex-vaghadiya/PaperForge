"""
FastAPI entry point for Hinex PaperForge API.

Supports two modes:
- Full mode (Docker/HF Spaces): PaddleOCR + WeasyPrint
- Local mode (Windows): Mock OCR + HTML-based PDF fallback
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="OCR processing and PDF generation API for Hinex PaperForge",
    version="1.0.0",
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

# Check which services are available
_ocr_available = False
_pdf_available = False

try:
    from paddleocr import PaddleOCR
    _ocr_available = True
except ImportError:
    pass

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
        "version": "1.0.0",
        "ocr_engine": "paddleocr" if _ocr_available else "mock",
        "pdf_engine": "weasyprint" if _pdf_available else "html_fallback",
    }

@app.get("/")
async def root():
    """Root endpoint for HF Spaces UI."""
    return {"message": "PaperForge Backend API is running successfully!"}
