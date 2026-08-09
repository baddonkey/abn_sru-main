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
- Embedded `library-data` JSON in `index.html`: ABN scopes, short codes, optional field-filter overrides, and display names
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
- `recentMonthCount`: how many months to include, default `1` (current month)
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
- `recentMonthCount`: `1`
- `maximumRecords`: `1000`
- `displayLimit`: `1000`
- `showThumbnails`: `false`

With the default configuration, the widget queries the current month using the local field 990 code pattern. The timeline slider can extend the period to the preceding 11 months. In July 2026, the default query becomes:

```text
alma.local_field_990=NELAKB2607
```

The widget fetches up to 1000 matching MARC records, sorts them client-side by local field 990 descending, uses MARC field 005 as a tie-breaker, and then renders all fetched records.

Thumbnails are disabled by default because Open Library returns HTTP 404 for many catalog ISBNs. Enabling them can therefore add expected failed image requests to the browser console.

The **Bibliothek** filter offers all ABN libraries or one individual library. The **Zeitraum** filter includes the current month plus up to 11 preceding months. In the all-library view, the widget uses the SRU wildcard query `alma.local_field_990 all "NEL*YYMM"` for each selected month. An individual library uses an exact code such as `alma.local_field_990=NELAKBYYMM`.

`searchScope`, `tab`, `localField990Prefix`, and `recentMonthCount` define the initial selection. Library options are read from the embedded `library-data` JSON in `index.html`, so no separate JSON request is required when opening the page directly.

Each library uses `library-short` for its normal abbreviation. If the code in MARC field `990$a` differs, set `field-filter-short`; for example, `ABN_KSZ` keeps `library-short: "KSZ"` but uses `field-filter-short: "BZZ"` to query `NELBZZYYMM`. Without this optional property, the filter uses `library-short`.

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