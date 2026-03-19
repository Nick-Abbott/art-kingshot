#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import cv2
import torch
import pytesseract
from ultralytics import YOLO
from torchvision import models, transforms


ROOT_DIR = Path(__file__).resolve().parent
HEADER_BGR = (0xA9, 0xCC, 0xE6)
BODY_BGR = (0xEE, 0xFA, 0xFF)


def largest_color_region(image: cv2.Mat, color: tuple[int, int, int], tol: int = 6) -> tuple[int, int, int, int]:
    color_arr = cv2.UMat(cv2.merge([cv2.UMat(image[:, :, 0]), cv2.UMat(image[:, :, 1]), cv2.UMat(image[:, :, 2])]))
    lower = tuple(max(0, c - tol) for c in color)
    upper = tuple(min(255, c + tol) for c in color)
    mask = cv2.inRange(image, lower, upper)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise SystemExit("Could not locate body region by color.")
    contour = max(contours, key=cv2.contourArea)
    return cv2.boundingRect(contour)


def find_portrait(card: cv2.Mat) -> tuple[int, int, int, int] | None:
    h, w = card.shape[:2]
    if h == 0 or w == 0:
        return None

    corner = card[0:int(h * 0.15), int(w * 0.7):w]
    bg = tuple(int(x) for x in cv2.mean(corner)[:3])

    diff = cv2.absdiff(card, bg)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 18, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    left_mask = mask.copy()
    left_mask[:, int(w * 0.45):] = 0

    contours, _ = cv2.findContours(left_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    candidates = []
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = bw * bh
        if area < 0.05 * (w * h):
            continue
        candidates.append((area, x, y, bw, bh))

    if not candidates:
        return None

    _, x, y, bw, bh = max(candidates, key=lambda item: item[0])
    return x, y, bw, bh


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


def ocr_text(image: cv2.Mat, config: str, scale: int = 3) -> str:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.0)
    sharp = cv2.addWeighted(gray, 1.6, blur, -0.6, 0)
    thresh = cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
    )
    return pytesseract.image_to_string(thresh, config=config)


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


def _white_text_mask(image: cv2.Mat) -> cv2.Mat:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = ((s < 60) & (v > 190)).astype("uint8") * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def _preprocess_header_col(col: cv2.Mat) -> tuple[cv2.Mat, cv2.Mat, cv2.Mat]:
    # Variant A: Otsu on CLAHE grayscale.
    col_big = cv2.resize(col, None, fx=6, fy=6, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(col_big, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(gray)
    _, th = cv2.threshold(cl, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th_inv = cv2.bitwise_not(th)

    # Variant B: white-text mask in HSV, thickened.
    hsv = cv2.cvtColor(col, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = ((s < 80) & (v > 170)).astype("uint8") * 255
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
        iterations=2,
    )
    mask = cv2.resize(mask, None, fx=6, fy=6, interpolation=cv2.INTER_CUBIC)
    mask_inv = cv2.bitwise_not(mask)
    return th, th_inv, mask_inv


def parse_header_values(header: cv2.Mat, debug_dir: Path | None = None) -> dict[str, int | None]:
    if header.size == 0:
        return {
            "totalTroopsCurrent": None,
            "totalTroopsCapacity": None,
            "marchQueueCurrent": None,
            "marchQueueCapacity": None,
            "injuredCurrent": None,
            "injuredCapacity": None,
        }

    # Mask for white header numbers (tight HSV) on the lower band only.
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
    compact = re.sub(r"\s+", "", text)

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
                value_left = normalize_count(f"{left}{unit}")
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


class ScreenshotProcessor:
    def __init__(
        self,
        model_path: Path,
        type_model_path: Path,
        type_classes_path: Path,
        tier_model_path: Path,
        tier_classes_path: Path,
    ) -> None:
        self.detector = YOLO(str(model_path))

        self.type_classes = json.loads(type_classes_path.read_text(encoding="utf-8"))
        self.type_model = models.mobilenet_v3_small(weights=None)
        self.type_model.classifier[3] = torch.nn.Linear(
            self.type_model.classifier[3].in_features,
            len(self.type_classes),
        )
        self.type_model.load_state_dict(torch.load(type_model_path, map_location="cpu"))
        self.type_model.eval()

        self.tier_classes = json.loads(tier_classes_path.read_text(encoding="utf-8"))
        self.tier_model = models.mobilenet_v3_small(weights=None)
        self.tier_model.classifier[3] = torch.nn.Linear(
            self.tier_model.classifier[3].in_features,
            len(self.tier_classes),
        )
        self.tier_model.load_state_dict(torch.load(tier_model_path, map_location="cpu"))
        self.tier_model.eval()

        self.type_tf = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((128, 128)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        self.tier_tf = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((96, 96)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def process(
        self,
        image: cv2.Mat,
        conf: float = 0.25,
        debug_dir: Path | None = None,
        verbose: bool = False,
    ) -> dict:
        bx, by, bw, bh = largest_color_region(image, BODY_BGR, tol=6)
        body = image[by:by + bh, bx:bx + bw]
        hx, hy, hw, hh = largest_color_region(image, HEADER_BGR, tol=6)
        header = image[hy:hy + hh, hx:hx + hw]

        if debug_dir is not None:
            debug_dir.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(debug_dir / "header.png"), header)
            cv2.imwrite(str(debug_dir / "body.png"), body)

        header_values = parse_header_values(header, debug_dir=debug_dir)

        results = self.detector.predict(source=body, conf=conf, verbose=False)
        if not results:
            raise SystemExit("No detections.")

        troops = []
        result = results[0]
        boxes = result.boxes if result.boxes is not None else []
        for idx, box in enumerate(boxes):
            xmin, ymin, xmax, ymax = [int(round(v)) for v in box.xyxy[0].tolist()]
            card = body[ymin:ymax, xmin:xmax].copy()
            if card.size == 0:
                continue

            portrait = find_portrait(card)
            if portrait is None:
                continue

            h, w = card.shape[:2]
            px, py, pw, ph = portrait

            icon_x = int(round(px - pw * 0.08))
            icon_y = int(round(py - ph * 0.02))
            icon_w = int(round(pw * 0.28))
            icon_h = int(round(ph * 0.28))
            icon_x = max(0, icon_x)
            icon_y = max(0, icon_y)
            icon_w = min(icon_w, w - icon_x)
            icon_h = min(icon_h, h - icon_y)

            tier_x = int(round(px + pw * 0.2))
            tier_y = int(round(py + ph * 0.72))
            tier_w = int(round(pw * 0.6))
            tier_h = int(round(ph * 0.22))

            count_x = int(round(px + pw * 1.05))
            count_y = int(round(py + ph * 0.45))
            count_w = int(round(w - count_x - pw * 0.05))
            count_h = int(round(ph * 0.35))

            icon_crop = card[icon_y:icon_y + icon_h, icon_x:icon_x + icon_w]
            tier_crop = card[tier_y:tier_y + tier_h, tier_x:tier_x + tier_w]
            count_crop = card[count_y:count_y + count_h, count_x:count_x + count_w]

            if debug_dir is not None:
                cv2.imwrite(str(debug_dir / f"card_{idx}.png"), card)
                overlay = card.copy()
                cv2.rectangle(
                    overlay,
                    (count_x, count_y),
                    (min(w - 1, count_x + count_w), min(h - 1, count_y + count_h)),
                    (0, 255, 0),
                    2,
                )
                cv2.imwrite(str(debug_dir / f"card_{idx}_overlay.png"), overlay)

            if count_crop.size:
                gray = cv2.cvtColor(count_crop, cv2.COLOR_BGR2GRAY)
                gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                count_ocr_crop = thresh
            else:
                count_ocr_crop = count_crop

            type_name = None
            if icon_crop.size:
                tensor = self.type_tf(icon_crop).unsqueeze(0)
                with torch.no_grad():
                    logits = self.type_model(tensor)
                    probs = torch.softmax(logits, dim=1).squeeze(0)
                    _, cls_idx = torch.max(probs, dim=0)
                    type_name = self.type_classes[int(cls_idx)]

            tier_name = None
            if tier_crop.size:
                tensor = self.tier_tf(tier_crop).unsqueeze(0)
                with torch.no_grad():
                    logits = self.tier_model(tensor)
                    probs = torch.softmax(logits, dim=1).squeeze(0)
                    _, cls_idx = torch.max(probs, dim=0)
                    tier_name = self.tier_classes[int(cls_idx)]

            if debug_dir is not None:
                cv2.imwrite(str(debug_dir / f"card_{idx}_count.png"), count_crop)
                if count_ocr_crop is not None and count_ocr_crop.size:
                    cv2.imwrite(str(debug_dir / f"card_{idx}_count_ocr.png"), count_ocr_crop)
                else:
                    cv2.imwrite(str(debug_dir / f"card_{idx}_count_ocr.png"), count_crop)

            if count_ocr_crop is not None and count_ocr_crop.size:
                count_ocr_crop = cv2.copyMakeBorder(
                    count_ocr_crop,
                    0,
                    0,
                    6,
                    0,
                    cv2.BORDER_CONSTANT,
                    value=255,
                )
            count_raw = ocr_tesseract(
                cv2.dilate(count_ocr_crop, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)), iterations=1)
                if count_ocr_crop is not None and count_ocr_crop.size
                else count_ocr_crop,
                "0123456789,",
                11,
            )
            digits_only = "".join(ch for ch in count_raw if ch.isdigit())
            if not digits_only and count_ocr_crop is not None and count_ocr_crop.size:
                count_raw = ocr_tesseract(count_ocr_crop, "0123456789,", 7)
                digits_only = "".join(ch for ch in count_raw if ch.isdigit())
            count_value = int(digits_only) if digits_only else None
            if verbose:
                print(
                    f"card[{idx}] count_crop=({count_x},{count_y},{count_w},{count_h}) "
                    f"raw='{count_raw.strip()}' digits='{digits_only}' value={count_value}"
                )

            troops.append({"type": type_name, "tier": tier_name, "count": count_value})

        return {"header": header_values, "troops": troops}


def process_image(
    image: cv2.Mat,
    model_path: Path,
    type_model_path: Path,
    type_classes_path: Path,
    tier_model_path: Path,
    tier_classes_path: Path,
    conf: float = 0.25,
    debug_dir: Path | None = None,
    verbose: bool = False,
) -> dict:
    processor = ScreenshotProcessor(
        model_path=model_path,
        type_model_path=type_model_path,
        type_classes_path=type_classes_path,
        tier_model_path=tier_model_path,
        tier_classes_path=tier_classes_path,
    )
    return processor.process(image, conf=conf, debug_dir=debug_dir, verbose=verbose)


def main() -> None:
    parser = argparse.ArgumentParser(description="Process a screenshot and return card types/tiers/counts.")
    parser.add_argument("image", help="Screenshot path")
    parser.add_argument("--model", default=str(ROOT_DIR / "models" / "card_classifier" / "model.pt"), help="Path to card detector")
    parser.add_argument("--type-model", default=str(ROOT_DIR / "models" / "type_classifier" / "model.pt"), help="Path to type classifier")
    parser.add_argument("--type-classes", default=str(ROOT_DIR / "models" / "type_classifier" / "classes.json"), help="Path to type classes json")
    parser.add_argument("--tier-model", default=str(ROOT_DIR / "models" / "tier_classifier" / "model.pt"), help="Path to tier classifier")
    parser.add_argument("--tier-classes", default=str(ROOT_DIR / "models" / "tier_classifier" / "classes.json"), help="Path to tier classes json")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--debug-dir", help="Optional directory for debug crops")
    parser.add_argument("--verbose", action="store_true", help="Print per-card debug info")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")

    image = cv2.imread(str(image_path))
    if image is None:
        raise SystemExit(f"Could not read image: {image_path}")

    debug_dir = Path(args.debug_dir) if args.debug_dir else None
    processor = ScreenshotProcessor(
        model_path=Path(args.model),
        type_model_path=Path(args.type_model),
        type_classes_path=Path(args.type_classes),
        tier_model_path=Path(args.tier_model),
        tier_classes_path=Path(args.tier_classes),
    )
    result = processor.process(image, conf=args.conf, debug_dir=debug_dir, verbose=args.verbose)
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
