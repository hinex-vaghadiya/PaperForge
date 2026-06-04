"""
Image preprocessor with OpenCV fallback.

When OpenCV is not available, passes images through unchanged.
"""

import numpy as np

_cv2_available = False
try:
    import cv2
    _cv2_available = True
except ImportError:
    pass


def preprocess_image(image_bytes: bytes) -> bytes:
    """Preprocess image for OCR. Falls back to passthrough if OpenCV unavailable."""
    if not _cv2_available:
        return image_bytes

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return image_bytes

    # Resize if too large
    h, w = img.shape[:2]
    if w > 2000:
        scale = 2000 / w
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = deskew(gray)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)

    if is_document_like(gray):
        gray = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )

    _, buffer = cv2.imencode(".jpg", gray, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return buffer.tobytes()


def deskew(image: np.ndarray) -> np.ndarray:
    """Detect and correct image tilt."""
    edges = cv2.Canny(image, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)

    if lines is None:
        return image

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) < 15:
            angles.append(angle)

    if not angles:
        return image

    median_angle = np.median(angles)
    if abs(median_angle) < 0.5:
        return image

    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    return cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC,
                           borderMode=cv2.BORDER_REPLICATE)


def is_document_like(gray_image: np.ndarray) -> bool:
    """Check if the image looks like a document."""
    mean_val = np.mean(gray_image)
    std_val = np.std(gray_image)
    return mean_val > 120 and std_val > 30


def estimate_quality(image_bytes: bytes) -> dict:
    """Estimate image quality for OCR suitability."""
    if not _cv2_available:
        return {"score": 70, "issues": ["OpenCV not available — quality check skipped"]}

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if img is None:
        return {"score": 0, "issues": ["Could not decode image"]}

    issues = []
    score = 100
    h, w = img.shape

    if w < 500 or h < 500:
        issues.append("Low resolution")
        score -= 30
    elif w < 800:
        issues.append("Moderate resolution")
        score -= 10

    blur = cv2.Laplacian(img, cv2.CV_64F).var()
    if blur < 50:
        issues.append("Image is blurry")
        score -= 30
    elif blur < 100:
        issues.append("Slightly blurry")
        score -= 10

    std_val = np.std(img)
    if std_val < 20:
        issues.append("Very low contrast")
        score -= 25
    elif std_val < 40:
        issues.append("Low contrast")
        score -= 10

    return {
        "score": max(0, score),
        "resolution": f"{w}x{h}",
        "blur_metric": round(float(blur), 1),
        "contrast_metric": round(float(std_val), 1),
        "issues": issues,
    }
