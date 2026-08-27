#!/usr/bin/env python3
"""Export daily article selections as static JSON for jsDelivr."""

from __future__ import annotations

import concurrent.futures
import json
import os
import pathlib
import re
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone


ENDPOINT = "https://rvgvbxipccbkytmhltmi.functions.supabase.co/article-products"
OUTPUT_DIR = pathlib.Path("article-products-cache")
ALIAS_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,199}$")


def fetch_json(url: str, attempts: int = 3) -> object:
    error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except Exception as current_error:  # noqa: BLE001
            error = current_error
            if attempt + 1 < attempts:
                time.sleep(1 + attempt * 2)
    raise RuntimeError(f"Failed after {attempts} attempts: {url}") from error


def write_json(path: pathlib.Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as temporary:
        temporary.write(payload)
        temporary_path = temporary.name
    os.replace(temporary_path, path)


def export_alias(alias: str) -> tuple[str, int]:
    url = ENDPOINT + "?v=static&alias=" + urllib.parse.quote(alias)
    data = fetch_json(url)
    if not isinstance(data, dict) or not isinstance(data.get("products"), list):
        raise RuntimeError(f"Invalid selection response for {alias}")
    write_json(OUTPUT_DIR / f"{alias}.json", data)
    return alias, len(data["products"])


def main() -> None:
    aliases: list[str] = []
    for page in range(10000):
        manifest = fetch_json(ENDPOINT + f"?v=static-2&manifest=1&page={page}")
        page_aliases = manifest.get("aliases") if isinstance(manifest, dict) else None
        if not isinstance(page_aliases, list):
            raise RuntimeError("Invalid alias manifest")
        aliases.extend(str(alias) for alias in page_aliases)
        if not manifest.get("has_more"):
            break
    else:
        raise RuntimeError("Alias manifest exceeded the page limit")

    valid_aliases = sorted({str(alias) for alias in aliases if ALIAS_RE.fullmatch(str(alias))})
    if not valid_aliases:
        raise RuntimeError("Alias manifest is empty")

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(export_alias, valid_aliases))

    expected = {f"{alias}.json" for alias in valid_aliases}
    for path in OUTPUT_DIR.glob("*.json"):
        if path.name != "manifest.json" and path.name not in expected:
            path.unlink()

    write_json(
        OUTPUT_DIR / "manifest.json",
        {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "aliases": len(results),
            "products": sum(count for _, count in results),
        },
    )
    print(f"Exported {len(results)} aliases")


if __name__ == "__main__":
    main()
