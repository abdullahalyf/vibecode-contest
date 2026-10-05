# Static deployment

## Railway

The repository includes `Dockerfile` and `railway.json`. The build stage uses Node only to collect the ten runtime assets. The runtime image uses standard Caddy static-file hosting on port 8080. It does not execute project application logic, expose an app API, persist imported files, or require a database/volume. Browser imports and routing remain local.

Railway's CLI is signed in on this machine; the MCP server is not exposed to the desktop chat. Use the CLI or dashboard.

To publish after review:

```powershell
railway up --new --name smart-escape-practice --yes --detach
railway domain --port 8080 --json
railway deployment list --json
```

Use only one service. Do not select a database, volume, template app or plan upgrade. Confirm the deployment is healthy before claiming the URL works. Set the generated public HTTPS URL in README.md, then deploy the same reviewed source as the final recorded Git commit. CLI uploads and GitHub commits are different mechanisms: record the commit and deployment evidence explicitly.

Railway is resource-billed. The screenshot showed $3.87 of trial credit; actual remaining credit and site lifetime depend on usage. Do not promise availability for a fixed number of days. Free static hosting such as GitHub Pages remains a suitable alternative for this app.

Sources:
- https://docs.railway.com/guides/static-hosting
- https://docs.railway.com/services
- https://docs.railway.com/pricing/free-trial
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

## Acceptance before submission

Run `npm test`, `npm run build`, and browser acceptance against the public URL. Verify the five sample scenarios, JSON upload, Bangla and English, original-state reset and mobile layout. Confirm no login is required and HTTPS is valid. Run `npm run check:live` to compare SHA-256 hashes of all ten public assets with the local build. The optional `npm run check:map` verifies stable keyboard focus and extreme finite coordinates after the Puku map changes. Record the full final commit hash and deployment ID.

The real contest requires fresh code written after T+0 in the properly named new repository. This deployment is a practice run.
