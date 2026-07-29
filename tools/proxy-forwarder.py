#!/usr/bin/env python3
"""
proxy-forwarder.py — Standalone local forwarding proxy for the IAP-protected
farmtable Cloud Run service.

This is a fallback option when `gcloud run services proxy` is unavailable.
It mints IAP identity tokens via gcloud and forwards local HTTP requests to
the Cloud Run service with proper authentication headers.

Prerequisites:
  1. gcloud CLI installed and on PATH
  2. Authenticated with a @google.com account: `gcloud auth login`
  3. Python 3.7+

Usage:
  python3 proxy-forwarder.py [--port PORT]

  PORT defaults to 8080. Access the service at http://localhost:PORT
"""

import argparse
import http.server
import logging
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import ssl
import json
import sys

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CLOUD_RUN_URL = "https://farmtable-486315127503.us-central1.run.app"
IAP_CLIENT_ID = "486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com"

# Refresh the identity token 5 minutes before it expires (tokens are typically
# valid for 1 hour).
TOKEN_REFRESH_MARGIN_SECS = 300
TOKEN_REFRESH_INTERVAL_SECS = 3300  # 55 minutes

# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------
class TokenManager:
    """Manages an IAP identity token, refreshing it automatically."""

    def __init__(self, iap_client_id: str):
        self._iap_client_id = iap_client_id
        self._token: str | None = None
        self._lock = threading.Lock()
        self._refresh_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        """Fetch the initial token and start the background refresh loop."""
        self._refresh_token()
        self._refresh_thread = threading.Thread(
            target=self._refresh_loop, daemon=True
        )
        self._refresh_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._refresh_thread:
            self._refresh_thread.join(timeout=5)

    @property
    def token(self) -> str:
        with self._lock:
            if self._token is None:
                raise RuntimeError("Token not yet available — call start() first")
            return self._token

    def _refresh_token(self) -> None:
        """Mint a fresh identity token via gcloud."""
        try:
            result = subprocess.run(
                [
                    "gcloud", "auth", "print-identity-token",
                    f"--audiences={self._iap_client_id}",
                ],
                capture_output=True, text=True, check=True, timeout=30,
            )
            new_token = result.stdout.strip()
            if not new_token:
                raise RuntimeError("gcloud returned an empty token")
            with self._lock:
                self._token = new_token
            logging.info("Identity token refreshed successfully")
        except subprocess.CalledProcessError as exc:
            logging.error("Failed to mint identity token: %s", exc.stderr.strip())
            raise
        except subprocess.TimeoutExpired:
            logging.error("gcloud timed out while minting identity token")
            raise

    def _refresh_loop(self) -> None:
        while not self._stop_event.is_set():
            self._stop_event.wait(TOKEN_REFRESH_INTERVAL_SECS)
            if self._stop_event.is_set():
                break
            try:
                self._refresh_token()
            except Exception:
                logging.warning(
                    "Token refresh failed — will retry in 60 s. "
                    "Existing token may still be valid."
                )
                self._stop_event.wait(60)


# ---------------------------------------------------------------------------
# Forwarding proxy handler
# ---------------------------------------------------------------------------

# Hop-by-hop headers that must not be forwarded (RFC 2616 §13.5.1).
HOP_BY_HOP = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
})


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler that forwards to the Cloud Run service."""

    # Populated by the factory.
    token_manager: TokenManager
    upstream_base: str

    def do_GET(self):     self._proxy()
    def do_POST(self):    self._proxy()
    def do_PUT(self):     self._proxy()
    def do_PATCH(self):   self._proxy()
    def do_DELETE(self):  self._proxy()
    def do_HEAD(self):    self._proxy()
    def do_OPTIONS(self): self._proxy()

    def _proxy(self):
        upstream_url = self.upstream_base.rstrip("/") + self.path

        # Read request body if present.
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else None

        # Build upstream request, forwarding original headers.
        req = urllib.request.Request(upstream_url, data=body, method=self.command)
        for key, value in self.headers.items():
            if key.lower() in HOP_BY_HOP or key.lower() == "host":
                continue
            req.add_header(key, value)

        # Attach the IAP identity token.
        req.add_header("Authorization", f"Bearer {self.token_manager.token}")

        # Create an SSL context (default CA bundle).
        ssl_ctx = ssl.create_default_context()

        try:
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=120) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, value in resp.getheaders():
                    if key.lower() not in HOP_BY_HOP:
                        self.send_header(key, value)
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as exc:
            # Forward the upstream error status + body to the client.
            self.send_response(exc.code)
            for key, value in exc.headers.items():
                if key.lower() not in HOP_BY_HOP:
                    self.send_header(key, value)
            self.end_headers()
            err_body = exc.read()
            if err_body:
                self.wfile.write(err_body)
        except Exception as exc:
            logging.exception("Error proxying request to %s", upstream_url)
            self.send_error(502, f"Proxy error: {exc}")

    def log_message(self, fmt, *args):
        logging.info("REQUEST  %s", fmt % args)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Local forwarding proxy for the IAP-protected farmtable service."
    )
    parser.add_argument(
        "--port", type=int, default=8080,
        help="Local port to listen on (default: 8080)",
    )
    parser.add_argument(
        "--upstream", type=str, default=CLOUD_RUN_URL,
        help=f"Upstream Cloud Run URL (default: {CLOUD_RUN_URL})",
    )
    parser.add_argument(
        "--iap-client-id", type=str, default=IAP_CLIENT_ID,
        help="IAP OAuth client ID used as the identity token audience",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # Start the token manager.
    token_mgr = TokenManager(args.iap_client_id)
    logging.info("Minting initial identity token...")
    try:
        token_mgr.start()
    except Exception:
        logging.error(
            "Could not obtain an identity token. Make sure you are authenticated:\n"
            "  gcloud auth login          # for user accounts\n"
            "Exiting."
        )
        sys.exit(1)

    # Wire the handler.
    ProxyHandler.token_manager = token_mgr
    ProxyHandler.upstream_base = args.upstream

    server = http.server.HTTPServer(("127.0.0.1", args.port), ProxyHandler)
    logging.info(
        "Proxy listening on http://localhost:%d -> %s",
        args.port, args.upstream,
    )
    logging.info("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Shutting down...")
    finally:
        token_mgr.stop()
        server.server_close()


if __name__ == "__main__":
    main()
