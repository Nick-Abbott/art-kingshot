from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import cv2


def ocr_tesseract(image: cv2.Mat, whitelist: str, psm: int) -> str:
    with tempfile.TemporaryDirectory() as tmp_dir:
        img_path = Path(tmp_dir) / "crop.png"
        cv2.imwrite(str(img_path), image)
        cmd = [
            "tesseract",
            str(img_path),
            "stdout",
            "-l",
            "eng",
            "--oem",
            "1",
            "--psm",
            str(psm),
            "-c",
            f"tessedit_char_whitelist={whitelist}",
        ]
        result = subprocess.run(cmd, check=False, capture_output=True, text=True)
        return result.stdout.strip()
