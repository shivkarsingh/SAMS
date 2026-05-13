from fastapi import FastAPI, Request
from fastapi import Response, status
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.errors import AIServiceError
from app.services.service_registry import service_registry

app = FastAPI(
    title="SAMS AI Service",
    version="0.1.0",
    description=(
        "Attendance intelligence service for face enrollment, classroom recognition, "
        "identity verification, and future ML workflows."
    ),
)


@app.exception_handler(AIServiceError)
async def handle_ai_service_error(
    request: Request,
    exc: AIServiceError,
) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/")
def root() -> dict:
    return {"message": "SAMS AI service is running."}


@app.get("/health")
def health() -> dict:
    return service_registry.health_report()


@app.get("/ready")
def ready(response: Response) -> dict:
    report = service_registry.health_report()
    if not report["ready"]:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return report


app.include_router(router)
