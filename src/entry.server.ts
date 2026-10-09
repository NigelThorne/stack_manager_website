import { Effect } from 'effect'
import { Server } from 'foldkit/experimental'

import { init, view } from './main'

export const renderDocument: Server.DocumentRenderer = (
  application,
  assets,
) => {
  const isQuickstart = application.title.startsWith('Quickstart')
  const description = isQuickstart
    ? 'Install Stack Manager, register a reviewed project configuration and run your first local working stack.'
    : 'Run independent local copies of your codebase. Develop and test changes in parallel, then review each one end to end before you share it.'
  const head = [
    `<meta name="description" content="${description}">`,
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Stack Manager">',
    `<meta property="og:title" content="${application.title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta name="theme-color" content="#07111f">',
  ].join('')
  return Server.renderDocument(application, assets, { head })
}

export const prerenderPaths: ReadonlyArray<string> = ['/', '/quickstart']

export const renderPage = (request: Request): Promise<Server.EntryResult> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const renderedApplication = yield* Server.renderToString(
        { routing: {}, init, view },
        { url: request.url },
      )

      return Server.Rendered(renderedApplication)
    }),
  )
