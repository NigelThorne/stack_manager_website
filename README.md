# Stack Manager website

The product site for [Stack Manager](https://github.com/NigelThorne/stack-manager), a configuration-driven local development stack runner.

Target URL: **https://stackmanager.nigelthorne.com**. A target URL in this document does not mean it is deployed.

## Run locally

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev --host 127.0.0.1
```

Node 22.22.2 and pnpm 10.34.6 are pinned. Foldkit 0.167.0 and Effect 4.0.0 provide static generation and browser hydration. Alchemy 2.0.0-beta.81 manages hosting resources. These APIs are beta or experimental; review matching versions before upgrading. The Effect SQL overrides and TypeScript 6 pin satisfy Alchemy's transitive peer requirements.

## Check the release

```sh
mise exec -- pnpm format:check
mise exec -- pnpm lint
mise exec -- pnpm typecheck
mise exec -- pnpm test
mise exec -- pnpm test:e2e
```

The last command builds and runs an isolated local Cloudflare Pages server on `127.0.0.1:5198`. Headless browser tests cover initial HTML, no-JavaScript navigation, hydration, the workflow demo, responsive layout, keyboard access, reduced motion, automated WCAG checks and real 404 status. They do not use a personal browser or create cloud resources.

`pnpm build` produces `dist/client` for publishing and a build-time renderer under `dist/server`. Only `dist/client` is uploaded. The site has no API, database, login, analytics or forms. The workflow preview is illustrative, not connected to the visitor's machine.

## Hosting and DNS

```text
Foldkit SSG → dist/client → Cloudflare Pages
                                ↑
stackmanager.nigelthorne.com → Route 53 CNAME
```

`nigelthorne.com` currently uses AWS Route 53 nameservers. Cloudflare Pages supports a custom subdomain on externally hosted DNS, avoiding any migration of the parent domain.

- Alchemy stack: `StackManagerWebsite`, stage `prod`, profile `default`.
- Cloudflare account: `bcd94aafc110a8c2e44a1d013e7e0081`, cloudflare@nigelthorne.com's account.
- New direct-upload Pages project: `stack-manager-website`, production branch `main`.
- Custom domain: `stackmanager.nigelthorne.com`.
- DNS: one CNAME to the exact `pagesHostname` returned by Alchemy, expected `stack-manager-website.pages.dev`. Do not assume availability before creation.
- State: private local `.alchemy/`. No remote-state bootstrap, existing-zone adoption, apex changes, nameserver changes, database or Worker Functions.

Alchemy's Pages deployment resource currently creates an empty manifest and cannot upload files. Alchemy therefore owns the project and domain attachment, while the official Wrangler uploader publishes the built assets. Do not replace this with an empty Alchemy Pages Deployment resource.

A Direct Upload project cannot later be converted to Cloudflare Git integration. Local deployments are deliberate; the repository has no automatic production-deploy workflow.

## Publish, only after rollout approval

Read-only checks:

```sh
mise exec -- pnpm alchemy profile list
mise exec -- pnpm exec wrangler whoami
mise exec -- pnpm cloudflare:plan
```

The stack refuses any stage other than `prod` and any Cloudflare profile pointing at a different account. The upload script pins the same account through `CLOUDFLARE_ACCOUNT_ID`, since Wrangler Pages does not accept `account_id` in its config. This is a public account identifier, not a credential. Use interactive Alchemy/Wrangler login if required; never copy tokens into the repository or chat.

After approval of the exact account, plan, build, DNS record, costs and rollback:

1. Back up `.alchemy/` privately if it exists. Keep one deployment owner.
2. Run all local checks and commit the reviewed source. Create/push the GitHub repository only with publication approval.
3. Run `mise exec -- pnpm cloudflare:provision`. This creates or reconciles the Pages project and domain attachment, not the website assets.
4. Run `mise exec -- pnpm build`, then `mise exec -- pnpm cloudflare:upload`. Confirm the Pages URL serves the reviewed site.
5. Attach the approved Route 53 CNAME to the exact Pages hostname. First creation must use CREATE, not an UPSERT over a possibly existing record. Stop if the hostname already has a record.
6. Verify Pages domain activation, DNS, TLS, `/`, `/quickstart`, assets, and a missing page returning 404. Keep the parent domain's existing records unchanged.
7. Back up `.alchemy/` again. Record the commit, deployment ID, URLs and DNS change ID privately.

`pnpm cloudflare:deploy` combines build, Alchemy provisioning and Wrangler upload. It does **not** change Route 53. Neither script is safe to run as a dry run. Do not run `alchemy dev`, which can mutate cloud resources; use `pnpm dev` instead.

## Cost and rollback

This is static Pages hosting without Functions. Cloudflare documents free static asset requests, subject to its Pages plan and file/build limits. Route 53 retains the existing hosted-zone charges and can charge for DNS queries. Confirm current plans and usage before publication; no paid plan upgrade is part of this project.

For a content regression, use the previous Pages deployment or rebuild the previous verified commit and upload it. Keep the project, domain attachment and local Alchemy state. For the first deployment there is no previous release: with explicit removal approval, remove only the new CNAME/domain attachment/project. Never remove the parent zone or discard state to recover.

If provisioning or upload fails, inspect the saved state and cloud status before retrying. A failed upload can leave an empty new project; a failed DNS step can leave a working Pages URL without the custom hostname.
