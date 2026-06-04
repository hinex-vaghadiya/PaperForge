"""
PaddleOCR wrapper service with local mock fallback.
"""

import numpy as np

_ocr_available = False
try:
    from paddleocr import PaddleOCR
    _ocr_available = True
except ImportError:
    pass

# Initialize PaddleOCR once (model loading is expensive)
_ocr_instance = None


def get_ocr():
    """Get or create the PaddleOCR singleton instance."""
    global _ocr_instance
    if not _ocr_available:
        return None
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            use_gpu=False,
            show_log=False,
            cpu_threads=2,
        )
    return _ocr_instance


def extract_text(image_bytes: bytes) -> dict:
    """
    Extract text from an image using PaddleOCR.
    Falls back to mock data when PaddleOCR is not installed.
    """
    if not _ocr_available:
        return _mock_extract()

    import cv2

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "raw_text": "",
            "lines": [],
            "confidence": 0.0,
            "error": "Could not decode image",
        }

    ocr = get_ocr()
    result = ocr.ocr(img, cls=True)

    if not result or not result[0]:
        return {"raw_text": "", "lines": [], "confidence": 0.0}

    lines = []
    confidences = []

    for line in result[0]:
        bbox, (text, conf) = line
        lines.append({
            "text": text,
            "confidence": round(float(conf), 3),
            "bbox": [[int(p[0]), int(p[1])] for p in bbox],
        })
        confidences.append(float(conf))

    raw_text = "\n".join([l["text"] for l in lines])
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "raw_text": raw_text,
        "lines": lines,
        "confidence": round(avg_confidence, 3),
    }


def _mock_extract() -> dict:
    """Mock OCR output for local testing without PaddleOCR."""
    mock_text = """Q1. Define Newton's First Law of Motion. (2 marks)
Q2. A car travels 100 km in 2 hours. Calculate the average speed of the car. (3 marks)
Q3. Explain the difference between distance and displacement with an example. (3 marks)
Q4. State whether True or False: "An object at rest will remain at rest unless acted upon by an unbalanced force." (1 mark)
Q5. Match the following:
(a) Force - (i) kg m/s²
(b) Mass - (ii) m/s²
(c) Acceleration - (iii) Newton
(d) Weight - (iv) kilogram (2 marks)"""

    return {
        "raw_text": mock_text,
        "lines": [
            {"text": line.strip(), "confidence": 0.95, "bbox": [[0, 0], [100, 0], [100, 20], [0, 20]]}
            for line in mock_text.strip().split("\n")
            if line.strip()
        ],
        "confidence": 0.95,
        "mock": True,
    }
