# SRU New Books Widget (Vanilla JS)

This project is a lightweight widget that displays new arrivals from a library catalog exposed via an SRU interface.

## Tech Stack
- HTML
- CSS
- JavaScript (no frameworks)

## Project Structure
- `index.html`: page and widget container
- `styles/main.css`: visual design and responsive layout
- `js/config.js`: SRU endpoint and query settings
- `js/sru-widget.js`: SRU fetch + XML parsing + rendering helpers
- `js/main.js`: app bootstrap and refresh handling
- `.github/copilot-instructions.md`: repository-specific Auto mode guidance for Copilot
- `AGENTS.md`: coding-agent workflow and contribution guardrails

## Configure Your SRU Endpoint
Edit `js/config.js`:
- `endpoint`: your SRU base URL
- `query`: your CQL query for new books when no dynamic local-field filter is active
- `recordSchema`: usually `dc` or the schema your server supports
- `sortKeys`: choose a date-based field available on your SRU server
- `searchScope`: optional discovery scope (for ABN for example `ABN_AKB`, `ABN_HFGS`, `ABN_AKS`)
- `tab`: optional discovery tab value, usually same as `searchScope`
- `vid`: optional discovery view ID
- `localField990Prefix`: local accession prefix, for example `NELAKB`
- `recentMonthCount`: how many months to include, default `2`
- `maximumRecords`: how many SRU records to fetch before local sorting
- `displayLimit`: how many sorted records to render in the widget
- `showThumbnails`: whether ISBN-based cover thumbnails should be shown

Default values are preconfigured for swisscovery ABN:
- `endpoint`: `https://swisscovery.slsp.ch/view/sru/41SLSP_ABN`
- `version`: `1.2`
- `searchScope`: `ABN_AKB`
- `tab`: `ABN_AKB`
- `vid`: `41SLSP_ABN:ABN`
- `localField990Prefix`: `NELAKB`
- `recentMonthCount`: `2`
- `maximumRecords`: `1000`
- `displayLimit`: `1000`
- `showThumbnails`: `false`

With this configuration, the widget automatically queries the current and previous month using the local field 990 code pattern. In July 2026, that becomes:

```text
alma.local_field_990=NELAKB2607 or alma.local_field_990=NELAKB2606
```

The widget fetches up to 1000 matching MARC records, sorts them client-side by local field 990 descending, uses MARC field 005 as a tie-breaker, and then renders all fetched records.

For another ABN scope, replace both `searchScope` and `tab` with either `ABN_HFGS` or `ABN_AKS`.
If another library uses a different local 990 prefix, replace `localField990Prefix` accordingly.

## Run Locally
From the project root:

```bash
python3 -m http.server 5500
```

Then open http://localhost:5500 in your browser.

## Notes
- Some SRU servers block browser-origin requests without CORS headers. If requests fail, verify CORS support on the SRU endpoint.
- XML fields differ across catalogs. If needed, adjust parsing in `js/sru-widget.js`.
- ALMA SRU implementations may reject some `sortKeys` combinations; this project keeps sorting optional and relies on the endpoint's default order unless `sortKeys` is explicitly set.