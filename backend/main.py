import uvicorn


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8000
    print(f"Backend started on http://{host}:{port}")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
    )
