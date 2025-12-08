from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load env from root
load_dotenv("../.env.local")

app = FastAPI(
    title="ContentPilot AI Service",
    description="AI processing service for SEO ContentForge",
    version="0.1.0"
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": "ContentPilot AI Service",
        "status": "running",
        "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet")
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
