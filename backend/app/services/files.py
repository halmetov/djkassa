import os
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

settings = get_settings()


async def save_upload(file: UploadFile, subdir: str | None = None) -> str:
    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower()
    if not ext:
        raise HTTPException(status_code=400, detail="Неверное имя файла")

    filename = f"product_{os.urandom(8).hex()}{ext}"
    media_dir = settings.media_root_path
    if subdir:
        media_dir = media_dir / subdir
    media_dir.mkdir(parents=True, exist_ok=True)
    destination = media_dir / filename

    with destination.open("wb") as buffer:
        while content := await file.read(1024 * 1024):
            buffer.write(content)
    await file.close()
    relative_path = filename if not subdir else f"{subdir}/{filename}"
    return relative_path
