from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(
    title="SAMS AI Service",
    version="0.1.0",
    description=(
        "Attendance intelligence service for face enrollment, classroom recognition, "
        "liveness verification, anti-spoofing, and future ML workflows."
    ),
)


@app.get("/")
def root() -> dict:
    return {"message": "SAMS AI service is running."}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(router)
