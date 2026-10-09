import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Output from 'alchemy/Output'
import { localState } from 'alchemy/State/LocalState'
import * as Effect from 'effect/Effect'

const accountId = 'bcd94aafc110a8c2e44a1d013e7e0081'

export default Alchemy.Stack(
  'StackManagerWebsite',
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    if (stage !== 'prod') {
      return yield* Effect.die(
        new Error(
          'This site only supports the explicitly selected prod stage. Use pnpm dev for local development.',
        ),
      )
    }
    const account = yield* yield* Cloudflare.CloudflareEnvironment
    if (account.accountId !== accountId) {
      return yield* Effect.die(
        new Error(
          'Cloudflare profile does not target the reviewed website account.',
        ),
      )
    }
    const project = yield* Cloudflare.Pages.Project('Website', {
      name: 'stack-manager-website',
      productionBranch: 'main',
    })
    const domain = yield* Cloudflare.Pages.Domain('Domain', {
      projectName: project.name,
      name: 'stackmanager.nigelthorne.com',
    })
    return {
      project: project.name,
      pagesHostname: project.subdomain,
      url: domain.name.pipe(Output.map(name => `https://${name}`)),
      dnsRequired:
        'Route 53 CNAME to the returned pagesHostname; no nameserver change.',
    }
  }),
)
