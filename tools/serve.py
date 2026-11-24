"""Dev server: static files with caching disabled, so phones always load the latest code.

Usage: python3 tools/serve.py [port] [bind-address]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 8173
DEFAULT_BIND = "0.0.0.0"


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    bind = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_BIND
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer((bind, port), handler) as server:
        print(f"Serving {ROOT} on http://{bind}:{port} (no cache)", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
