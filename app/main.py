from fastapi import FastAPI
from app.api.tracker import router

app = FastAPI(
    title="Shopify Rank Tracker API",
    description="API for tracking Shopify app keyword rankings, persisting history, and retrieving ranking data.",
    version="1.0.0",
)

@app.get("/")
def root():
    return {"message": "Welcome to Shopify Rank Tracker API"}

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
