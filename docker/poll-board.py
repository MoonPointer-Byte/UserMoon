#!/usr/bin/env python3
import json
import time
import urllib.request

for i in range(24):
    with urllib.request.urlopen("http://127.0.0.1/api/board", timeout=10) as r:
        board = json.load(r)
    status = board.get("status")
    msg = (board.get("message") or "")[:160]
    print(f"{i} {status} {msg}", flush=True)
    if status in ("running", "error", "idle"):
        print(
            json.dumps(
                {
                    "activeId": board.get("activeId"),
                    "status": status,
                    "message": board.get("message"),
                    "previewUrl": board.get("previewUrl"),
                    "port": board.get("port"),
                },
                ensure_ascii=False,
            )
        )
        break
    time.sleep(20)
