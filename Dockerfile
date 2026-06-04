# Forwarding Dockerfile for HuggingFace Spaces
# HF Spaces expects the Dockerfile at the root, so we just copy the backend and run it.

FROM python:3.11-slim

# Install system dependencies for OpenCV and WeasyPrint
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

# Copy the backend code and requirements
COPY ./backend /code/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Create a non-root user (HuggingFace requirement)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app
COPY --chown=user ./backend $HOME/app

# Run the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
