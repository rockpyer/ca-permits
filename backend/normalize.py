from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from config import WELLFINDER_URL, WELLSTAR_PUBLIC_URL


def normalize_api(api: Any) -> dict[str, str | None]:
    api_raw = None if api is None else str(api).strip()
    digits = re.sub(r"\D", "", api_raw or "")
    api_10 = digits[:10] if len(digits) >= 10 else None
    wellbore_id = digits[10:] or None if len(digits) > 10 else None
    api_display = None
    if api_10:
        api_display = f"{api_10[:2]}-{api_10[2:5]}-{api_10[5:]}"
    return {
        "api_raw": api_raw,
        "api_10": api_10,
        "api_display": api_display,
        "wellbore_id": wellbore_id,
    }


def arcgis_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).date().isoformat()
    text = str(value).strip()
    return text or None


def stable_source_key(parts: list[Any]) -> str:
    normalized = "|".join("" if part is None else str(part).strip() for part in parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def generated_links(api_10: str | None) -> dict[str, str | None]:
    if not api_10:
        return {"wellstar_url": None, "wellfinder_url": None}
    return {
        "wellstar_url": f"{WELLSTAR_PUBLIC_URL}?api={api_10}",
        "wellfinder_url": f"{WELLFINDER_URL}?api={api_10}",
    }


def notice_type_label(notice_type: str | None) -> str | None:
    if not notice_type:
        return None
    return notice_type.replace("NOI - ", "").replace("NOI", "General")
