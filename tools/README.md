# Farmtable Local Proxy Tools

Local forwarding proxy scripts for accessing the IAP-protected **farmtable** Cloud Run service from your development machine.

## Prerequisites

1. **gcloud CLI** installed — https://cloud.google.com/sdk/docs/install
2. **Authenticated with your @google.com account:**
   ```bash
   gcloud auth login
   ```
   The IAP policy on this service grants `roles/iap.httpsResourceAccessor` to `domain:google.com`, so any authenticated `@google.com` account has access. No service account or special key is needed.

## Option 1: `proxy-gcloud.sh` (Recommended)

Uses `gcloud run services proxy`, which is purpose-built for proxying IAP-protected Cloud Run services. It handles token minting and refresh automatically.

### Requirements

- The `cloud-run-proxy` gcloud component must be installed:
  ```bash
  gcloud components install cloud-run-proxy
  ```

### Usage

```bash
# Start proxy on default port 8080
./proxy-gcloud.sh

# Start proxy on a custom port
./proxy-gcloud.sh 3000
```

Then open `http://localhost:8080` (or your chosen port) in your browser.

### How it works

`gcloud run services proxy` runs a local HTTP server that transparently intercepts requests, attaches an identity token from the active gcloud account, and forwards them to the Cloud Run service. Token refresh is handled automatically.

---

## Option 2: `proxy-forwarder.py` (Standalone Fallback)

A standalone Python forwarding proxy that doesn't depend on the `cloud-run-proxy` gcloud component — only needs `gcloud` on PATH for token minting.

### Requirements

- Python 3.7+
- `gcloud` CLI on PATH (used to mint identity tokens)
- No additional Python packages needed (uses only the standard library)

### Usage

```bash
# Start proxy on default port 8080
python3 proxy-forwarder.py

# Start proxy on a custom port
python3 proxy-forwarder.py --port 3000
```

Then open `http://localhost:8080` (or your chosen port) in your browser.

### Command-line options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | Local port to listen on |
| `--upstream` | `https://farmtable-486315127503.us-central1.run.app` | Upstream Cloud Run URL |
| `--iap-client-id` | *(auto-configured)* | IAP OAuth client ID for the identity token audience |

### How it works

1. On startup, mints an identity token via `gcloud auth print-identity-token --audiences=<IAP_CLIENT_ID>`
2. Runs a local HTTP server on `127.0.0.1:<port>`
3. Forwards all incoming HTTP requests to the Cloud Run service URL with `Authorization: Bearer <token>`
4. Refreshes the token automatically every 55 minutes (tokens expire after 1 hour)

---

## Service Details

| Field | Value |
|-------|-------|
| Service | `farmtable` |
| Project | `deploy-demo-test` |
| Region | `us-central1` |
| URL | `https://farmtable-486315127503.us-central1.run.app` |
| IAP OAuth Client ID | `486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com` |

---

## What Was Tested

**From the build environment** (running as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`, which also has `iap.httpsResourceAccessor` on this resource):

| Test | Result |
|------|--------|
| Mint identity token with IAP client ID audience | **Pass** — `gcloud auth print-identity-token --audiences=<IAP_CLIENT_ID>` returned a valid JWT |
| Authenticated curl to Cloud Run via IAP | **Pass** — HTTP 200 with correct HTML response |
| `proxy-forwarder.py` end-to-end | **Pass** — Started proxy on port 9999, `curl http://localhost:9999/` returned HTTP 200 with the farmtable HTML page |
| `proxy-gcloud.sh` / `gcloud run services proxy` | **Not tested** — The `cloud-run-proxy` gcloud component was not installed in the build environment. The script is straightforward and uses a well-documented gcloud command; it will work on a local machine with the component installed. |

**What the user should verify on their own machine:**
- That `gcloud auth login` with their `@google.com` account produces tokens that pass IAP (expected to work given the `domain:google.com` grant, but wasn't tested with a user account from this environment).
