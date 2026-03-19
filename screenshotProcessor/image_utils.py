from __future__ import annotations

import cv2


def largest_color_region(image: cv2.Mat, color: tuple[int, int, int], tol: int = 6) -> tuple[int, int, int, int]:
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
