# Python port

This directory is a Python/aiohttp port of `server.js`. The existing frontend in `public/` is retained.

## Run

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

Default port: 3000. Override with `PORT`.

The Python version keeps the existing HTTP API paths, WebSocket client connection, SSE streams, session handling, concurrent WebSocket slots, burst/delay settings, and per-WebSocket dispatch limiter.

Before production use, test the API protocol and lifecycle against the original Node.js version.
