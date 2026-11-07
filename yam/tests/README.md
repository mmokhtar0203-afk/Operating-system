# Automated acceptance tests (optional)

Requires Node and Playwright with Chromium. They drive the real UI against a local server on port 8765.

```bash
cd yam && python3 -m http.server 8765 &
node tests/e2e.js tests/fixtures     # 17-step acceptance workflow (22 checks)
node tests/extra.js tests/fixtures   # formula engine, templates, duplicate/move, archive, search
```

Generated PDFs, exports and screenshots are written to `tests/fixtures/`.
