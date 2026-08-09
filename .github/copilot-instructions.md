# Copilot Instructions For This Workspace

## Project Focus
- Build and maintain a standalone browser widget that renders the latest 10 books from an SRU endpoint.
- Use only vanilla HTML, CSS, and JavaScript.
- Keep browser code dependency-free.

## Working Rules
- Prefer small patches over broad rewrites.
- Do not introduce frameworks, bundlers, or transpilers unless explicitly requested.
- Keep edits limited to the relevant files for the current task.
- Preserve the visual style in [styles/main.css](styles/main.css).

## SRU Integration Rules
- Keep SRU settings in [js/config.js](js/config.js).
- Respect the SRU `searchRetrieve` operation and parameters.
- Keep XML parsing resilient for namespace-prefixed tags by matching local names.
- Handle empty results and request failures with user-visible status messages.

## Auto Mode Expectations
- In Auto mode, first scan for existing patterns before adding new structures.
- After making changes, validate quickly with lightweight checks and summarize impacts.
- When adding logic, include brief comments only when behavior is not obvious.

## File Map
- Entry page: [index.html](index.html)
- Styles: [styles/main.css](styles/main.css)
- Runtime config: [js/config.js](js/config.js)
- SRU client/widget logic: [js/sru-widget.js](js/sru-widget.js)
- App bootstrap: [js/main.js](js/main.js)