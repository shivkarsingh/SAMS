FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        libgomp1 \
        libglib2.0-0 \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV MODEL_DEVICE=cpu \
    FACE_ANALYSIS_PROVIDERS=CPUExecutionProvider \
    FACE_ANALYSIS_MODEL_PACK=antelopev2 \
    FACE_ANALYSIS_MODEL_PACKS=antelopev2,buffalo_l \
    FACE_ANALYSIS_AUTO_DOWNLOAD=true

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
