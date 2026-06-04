FROM python:3.11-slim

# System deps for OpenCV, WeasyPrint, pdf2image
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    libffi-dev shared-mime-info poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set writable home for HuggingFace Spaces
ENV HOME=/tmp
ENV PADDLEOCR_HOME=/tmp/.paddleocr

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
