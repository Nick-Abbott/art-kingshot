from __future__ import annotations

from pathlib import Path
import re

import cv2
import pytesseract

def normalize_count(raw: str) -> int:
    cleaned = raw.upper().replace(" ", "")
    cleaned = cleaned.replace("%", ".").replace("'", ".")
    cleaned = cleaned.replace(")", "").replace("(", "")
    cleaned = re.sub(r"(?<=\d)[IL](?=\d)", ".", cleaned)
    cleaned = cleaned.replace("A", "4").replace("S", "5").replace("O", "0")
    cleaned = cleaned.replace(",", "")

    if cleaned.endswith("K"):
        base_raw = cleaned[:-1]
        if "." not in base_raw and len(base_raw) >= 4:
            base_raw = f"{base_raw[:-1]}.{base_raw[-1]}"
        base = float(base_raw)
        return int(round(base * 1000))

    return int(float(cleaned))


def parse_header_values(header: cv2.Mat, debug_dir: Path | None = None) -> dict[str, int | None]:
    if header.size == 0:
        return {
            "totalTroops": None,
            "marchQueues": None,
            "infirmaryCapacity": None,
        }

    h, w = header.shape[:2]
    band = header[int(h * 0.20) : int(h * 0.95), :]
    hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
    _, s, v = cv2.split(hsv)
    mask = ((s < 35) & (v > 225)).astype("uint8") * 255
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)),
        iterations=1,
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)),
        iterations=1,
    )
    mask = cv2.resize(mask, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    inv = cv2.bitwise_not(mask)

    text = pytesseract.image_to_string(
        inv,
        config="--psm 6 -c tessedit_char_whitelist=0123456789Kk/.,",
    )

    if debug_dir is not None:
        cv2.imwrite(str(debug_dir / "header_white_mask.png"), mask)
        (debug_dir / "header_ocr.txt").write_text(text, encoding="utf-8")

    pair_regex = re.compile(r"(\d+(?:\.\d+)?)([A-Z])?\s*/\s*(\d+(?:\.\d+)?)([A-Z])?", re.IGNORECASE)
    pairs = pair_regex.findall(text)

    total_cap = None
    inj_cap = None
    march_cap = None

    for left, left_unit, right, right_unit in pairs:
        unit = (right_unit or left_unit or "").upper()
        try:
            if unit == "K":
                _ = normalize_count(f"{left}{unit}")
                value_right = normalize_count(f"{right}{unit}")
                if total_cap is None:
                    total_cap = value_right
                else:
                    inj_cap = value_right
            else:
                cap = int(float(right))
                if 1 <= cap <= 6:
                    march_cap = cap
        except ValueError:
            continue

    return {
        "totalTroops": total_cap,
        "marchQueues": march_cap,
        "infirmaryCapacity": inj_cap,
    }
