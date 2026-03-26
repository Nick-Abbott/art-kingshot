#!/usr/bin/env python3
from __future__ import annotations

import tempfile
from pathlib import Path

import cv2
import numpy as np
import anyio
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from screenshotProcessor.pipeline import ScreenshotProcessor

ROOT_DIR = Path(__file__).resolve().parent


def _decode_image(data: bytes) -> cv2.Mat:
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")
    return image


app = FastAPI(title="Screenshot Processor")

processor = ScreenshotProcessor(
    model_path=ROOT_DIR / "models" / "card_classifier" / "model.pt",
    type_model_path=ROOT_DIR / "models" / "type_classifier" / "model.pt",
    type_classes_path=ROOT_DIR / "models" / "type_classifier" / "classes.json",
    tier_model_path=ROOT_DIR / "models" / "tier_classifier" / "model.pt",
    tier_classes_path=ROOT_DIR / "models" / "tier_classifier" / "classes.json",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/process")
async def process_screenshot(
    file: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.0, le=1.0),
    type_conf_min: float = Query(0.6, ge=0.0, le=1.0),
    tier_conf_min: float = Query(0.6, ge=0.0, le=1.0),
    ocr_conf_min: float = Query(0.6, ge=0.0, le=1.0),
    verbose: bool = False,
    debug: bool = False,
) -> JSONResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")

    image = _decode_image(data)
    debug_dir = None
    if debug:
        debug_root = ROOT_DIR / "debug"
        debug_root.mkdir(parents=True, exist_ok=True)
        tmp_dir = Path(tempfile.mkdtemp(prefix="screenshot-debug-", dir=str(debug_root)))
        debug_dir = tmp_dir

    try:
        with anyio.fail_after(5):
            result = await anyio.to_thread.run_sync(
                processor.process,
                image,
                conf,
                type_conf_min,
                tier_conf_min,
                ocr_conf_min,
                debug_dir,
                verbose,
            )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Processing timed out.") from exc
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    troops = result.get("troops", []) if isinstance(result, dict) else []
    partial = any(
        troop.get("type") is None or troop.get("tier") is None or troop.get("count") is None
        for troop in troops
        if isinstance(troop, dict)
    )
    if isinstance(result, dict):
        meta = result.get("meta") if isinstance(result.get("meta"), dict) else {}
        meta["partial"] = partial
        result["meta"] = meta

    payload = {"result": result}
    if debug_dir is not None:
        payload["debugDir"] = str(debug_dir)
    return JSONResponse(payload, status_code=206 if partial else 200)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
