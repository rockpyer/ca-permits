"""Counts every request an ingest makes, so each run records how hard it hit the source.

All ingests fetch through `session()`. `take()` returns the counts since the last take and
resets them; store.record_run calls it, so each recorded run carries its own counts.
"""

from __future__ import annotations

import time
from collections import Counter
from typing import Any
from urllib.parse import urlsplit

import requests

USER_AGENT = "well-permit-tracker/0.1 (+https://permits.ryweller.com)"


class Meter:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.requests: Counter[str] = Counter()
        self.bytes: Counter[str] = Counter()
        self.errors: Counter[str] = Counter()
        self.statuses: Counter[str] = Counter()
        self.started = time.monotonic()

    def count(self, response: requests.Response, *args: Any, **kwargs: Any) -> None:
        host = urlsplit(response.url).hostname or "?"
        self.requests[host] += 1
        self.statuses[str(response.status_code)] += 1
        if response.status_code >= 400:
            self.errors[host] += 1
        # Reading the body here is free: none of the ingests stream.
        self.bytes[host] += len(response.content or b"")

    def snapshot(self) -> dict[str, Any]:
        return {
            "requests": sum(self.requests.values()),
            "bytes": sum(self.bytes.values()),
            "errors": sum(self.errors.values()),
            "seconds": round(time.monotonic() - self.started, 1),
            "by_host": {
                host: {"requests": self.requests[host], "bytes": self.bytes[host], "errors": self.errors[host]}
                for host in sorted(self.requests)
            },
            "statuses": dict(sorted(self.statuses.items())),
        }

    def take(self) -> dict[str, Any]:
        snap = self.snapshot()
        self.reset()
        return snap


METER = Meter()


def session(user_agent: str = USER_AGENT) -> requests.Session:
    client = requests.Session()
    client.headers["User-Agent"] = user_agent
    client.hooks["response"].append(METER.count)
    return client
