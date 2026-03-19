#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import cv2

from screenshotProcessor.pipeline import ScreenshotProcessor

ROOT_DIR = Path(__file__).resolve().parent


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
