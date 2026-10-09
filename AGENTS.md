# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: false

## Project Notes

Stack Manager's public product site. Read README.md before hosting changes. Use `mise exec -- pnpm <script>` with pinned Node and pnpm. The frontend is Foldkit SSG, not a SPA; preserve meaningful initial HTML, hydration, canonical metadata and real 404 behavior. No analytics, signup, backend or product-control API.

Keep headings regular-weight with nonnegative tracking, body text readable, spacing generous and motion optional. Product claims and quickstart commands must match ../stack_manager or its public repository. Do not describe the private npm package as published, or claim an open-source license that the product has not declared.

Alchemy manages a Cloudflare Pages project and its custom-domain attachment. Wrangler uploads prebuilt static assets because Alchemy's current Pages deployment resource cannot upload file content. DNS stays in AWS Route 53. Never move the parent domain's nameservers, adopt an existing cloud resource, create a paid service or change production without current approval of the exact rollout. Keep .alchemy state private and backed up; do not delete state to recover.

Use isolated headless browsers, not Nigel's desktop. Work on main; validate locally before any remote publication. A full Foldkit reference subtree is optional; use installed types and release-matched sources for this small site.
