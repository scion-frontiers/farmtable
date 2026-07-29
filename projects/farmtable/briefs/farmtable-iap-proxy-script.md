# Brief: Local Forwarding Proxy Script for IAP-Protected Farmtable Cloud Run Service

## Critical Constraints (read first)
- **Output goes in the scratchpad only** — `/scion-volumes/scratchpad/projects/farmtable/`
  — NOT the git repo. This is a personal/local dev tool for ptone@google.com, not
  application code.
- This is a scoped scripting task, not a feature — no worktree/PR/review process needed.

## Context
ptone@google.com put the `farmtable` Cloud Run service behind IAP (native Cloud Run IAP
integration). Coordinator already confirmed the IAM setup:
- Service: `farmtable`, project `deploy-demo-test`, region `us-central1`.
- Cloud Run's own `roles/run.invoker` is granted ONLY to Google's IAP service agent.
- IAP's own resource-level policy (`roles/iap.httpsResourceAccessor` on the Cloud Run
  IAP resource) grants access to `domain:google.com` (i.e. any authenticated Google corp
  account) and `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`.
- Since ptone@google.com is presumably a `domain:google.com` principal, they should already
  have IAP access via their own `gcloud auth login` identity.

ptone@google.com wants a script they can run FROM THEIR OWN MACHINE to reach the
IAP-protected service via a local forwarding proxy — mentioned `gcloud run services proxy`
or a simple Python forwarder as options.

## Task
1. **Primary approach**: `gcloud run services proxy` is purpose-built for exactly this (it
   handles IAP/IAM authentication automatically using the caller's local gcloud
   credentials, and proxies a local port to the Cloud Run service). Write a small shell
   script wrapping it with the correct flags:
   ```
   gcloud run services proxy farmtable --project=deploy-demo-test --region=us-central1 --port=<LOCAL_PORT>
   ```
   Include a comment explaining the user needs `gcloud auth login` with their
   `@google.com` account first (or `gcloud auth application-default login` depending on
   what `services proxy` actually requires — verify this by reading `gcloud run services
   proxy --help` and testing if you have credentials to do so; if you can't fully test end
   -to-end from this environment since it's the scion service account not the user's own
   account, note that clearly rather than claiming untested behavior works).
2. **Fallback approach**: also write a simple standalone Python script (no gcloud SDK
   dependency beyond what's needed to mint an identity token) that:
   - Obtains an identity token audienced to the IAP OAuth client ID for this resource
     (`gcloud auth print-identity-token --audiences=<IAP_CLIENT_ID>` — you'll need to look
     up the actual IAP OAuth client ID for this Cloud Run service, e.g. via `gcloud iap
     oauth-brands list` / `gcloud iap oauth-clients list` or equivalent, or by inspecting
     the IAP settings for this Cloud Run backend).
   - Runs a local HTTP server on a given port that forwards incoming requests to the
     Cloud Run service URL (`https://farmtable-486315127503.us-central1.run.app` or
     `https://farmtable-qo7k5fvpda-uc.a.run.app`), attaching `Authorization: Bearer
     <identity-token>` header, refreshing the token periodically since IAP identity tokens
     expire.
   - Keep this simple (standard library `http.server` + `urllib`/`requests` is fine) —
     this is a dev convenience script, not production code.
3. Test what you can from this environment (you're running as the scion service account,
   which per the IAP policy above DOES have `iap.httpsResourceAccessor`, so you should be
   able to validate the identity-token-minting + forwarding mechanism works end-to-end,
   even though the user will swap in their own `@google.com` identity when they run it
   locally).
4. Write a short README alongside the scripts explaining prerequisites (gcloud CLI
   installed and authenticated as a `@google.com` account) and usage for both options.

## Deliverables
1. `/scion-volumes/scratchpad/projects/farmtable/tools/proxy-gcloud.sh` — the `gcloud run
   services proxy` wrapper script.
2. `/scion-volumes/scratchpad/projects/farmtable/tools/proxy-forwarder.py` — the standalone
   Python fallback forwarder.
3. `/scion-volumes/scratchpad/projects/farmtable/tools/README.md` — usage + prerequisites
   for both, and what you actually tested vs. couldn't test from this environment.
4. A message to the coordinator confirming what was tested and any caveats.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST produce both scripts + README, test what's testable from this environment, and
message the coordinator with results and caveats. Then signal task_completed.
