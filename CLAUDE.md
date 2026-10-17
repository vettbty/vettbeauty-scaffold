@AGENTS.md

## Working rules for this repo

**Read before specifying.** Never write a patch for a file you have not read.
The GitHub blob page and the /contents API (base64) preserve JSX; plain
crawling strips tags and caused three wrong diagnoses.

**Measure before changing.** Add the measurement as step 1 of any change.
The build output is `.next/` (the site left static export on 2026-10-16, so
there is no `out/`). Examples that settle a question in one command:

    grep -rl "go.shopmy.us" .next/static/chunks/
    du -sh .next/server/app/* | sort -h
    find .next/server/app -name "*.html" -exec du -k {} + | awk '{s+=$1} END {print s/1024" MB"}'

**One change per commit, with a before/after number.** If a change cannot
state what it expects to move and by how much, it is not ready.

**Do not overstate.** Mark predictions as predictions. Do not claim a fallback
works until a bad value has been tested against it.

**Two data paths, never conflated:**

- `site_products` (Supabase) is what the live site reads.
- `src/lib/products.json` (committed) is the build-time fallback, written by
  `scripts/convert-csv.js`.

A hand edit in the Supabase editor does NOT invalidate pages. The pipeline
does: `convert-csv.js` → `scripts/lib/site-products.mjs` (upsert) →
`POST /api/revalidate`.

**Scoring is defined in one place: `src/lib/consensus.ts`.** Editorial
publications only. Korean platforms (Glowpick, Hwahae, Olive Young) are
rankings, never scored.
