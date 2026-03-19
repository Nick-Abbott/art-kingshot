from __future__ import annotations

import json
from pathlib import Path

import cv2
import torch
from torchvision import models, transforms
from ultralytics import YOLO

from screenshotProcessor.header import parse_header_values
from screenshotProcessor.image_utils import find_portrait, largest_color_region
from screenshotProcessor.ocr_utils import ocr_tesseract


HEADER_BGR = (0xA9, 0xCC, 0xE6)
BODY_BGR = (0xEE, 0xFA, 0xFF)


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
