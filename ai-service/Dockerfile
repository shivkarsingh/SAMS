FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV MODEL_DEVICE=cpu \
    FACE_ANALYSIS_PROVIDERS=CPUExecutionProvider \
    FACE_ANALYSIS_MODEL_PACK=antelopev2 \
    FACE_ANALYSIS_MODEL_PACKS=antelopev2,buffalo_l \
    FACE_ANALYSIS_AUTO_DOWNLOAD=true

RUN python -c "from app.services.service_registry import service_registry; report = service_registry.health_report(); print(report)"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
