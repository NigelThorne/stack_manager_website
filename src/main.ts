import { Effect, Schema } from 'effect'
import { Command, Dom, Runtime, type Update } from 'foldkit'
import { type Document, type Html, type HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest, load, pushUrl } from 'foldkit/navigation'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'
import { Url, toString as urlToString } from 'foldkit/url'

import { AppRoute, homeRouter, quickstartRouter, urlToAppRoute } from './route'

export const WorkflowStep = defineTaggedUnion({
  Configure: {},
  Create: {},
  Run: {},
})
export type WorkflowStep = typeof WorkflowStep.Type

export const Model = Schema.Struct({
  route: AppRoute,
  workflowStep: WorkflowStep,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  SelectedWorkflowStep: { step: WorkflowStep },
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
})
export type Message = typeof Message.Type

export const init: Runtime.RoutingApplicationInit<Model, Message> = url => ({
  model: {
    route: urlToAppRoute(url),
    workflowStep: WorkflowStep.Configure(),
  },
})

const NavigateInternal = Command.define('NavigateInternal', {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) =>
    pushUrl(url).pipe(
      Effect.flatMap(() =>
        url.endsWith('#features')
          ? Dom.scrollIntoViewAfterPaint('#features', { block: 'start' })
          : Dom.scrollIntoViewAfterPaint('.site-header', { block: 'start' }),
      ),
      Effect.flatMap(() =>
        Dom.focus(url.endsWith('#features') ? '#features-title' : 'main h1', {
          makeFocusable: true,
          preventScroll: true,
        }),
      ),
      Effect.as(Message.CompletedNavigateInternal()),
      Effect.catch(() => Effect.succeed(Message.CompletedNavigateInternal())),
    ),
})

const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
})

type UpdateReturn = Update.Return<Model, Message>

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SelectedWorkflowStep: ({ step }) => ({
      model: modifyFields(model, { workflowStep: () => step }),
    }),
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),
    ChangedUrl: ({ url }) => ({
      model: modifyFields(model, { route: () => urlToAppRoute(url) }),
    }),
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
  })

const GITHUB_URL = 'https://github.com/NigelThorne/stack-manager'
const CANONICAL_ROOT = 'https://stackmanager.nigelthorne.com'
const FEATURES_URL = `${homeRouter()}#features`

const logoView = (h: HtmlBuilder<Message>): Html =>
  h.a(
    [h.Href(homeRouter()), h.Class('brand'), h.AriaLabel('Stack Manager home')],
    [
      h.span(
        [h.Class('brand-mark'), h.AriaHidden(true)],
        [h.i([]), h.i([]), h.i([])],
      ),
      h.span([], ['Stack Manager']),
    ],
  )

const headerView = (h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('site-header')],
    [
      logoView(h),
      h.nav(
        [h.AriaLabel('Main navigation')],
        [
          h.a([h.Href(FEATURES_URL)], ['Features']),
          h.a([h.Href(quickstartRouter())], ['Quickstart']),
          h.a([h.Href(GITHUB_URL)], ['GitHub']),
        ],
      ),
    ],
  )

const terminalLine = (
  status: string,
  name: string,
  detail: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('terminal-line')],
    [
      h.span([h.Class(`status-dot ${status}`), h.AriaHidden(true)]),
      h.span([h.Class('terminal-name')], [name]),
      h.span([h.Class('terminal-detail')], [detail]),
    ],
  )

const stackVisualView = (h: HtmlBuilder<Message>): Html =>
  h.figure(
    [
      h.Class('stack-visual'),
      h.AriaLabel('Illustration of a three-service stack'),
    ],
    [
      h.div(
        [h.Class('visual-toolbar')],
        [
          h.span([], ['review']),
          h.span([h.Class('running-pill')], ['● running']),
        ],
      ),
      h.div(
        [h.Class('worktree-row')],
        [
          h.div(
            [h.Class('worktree-card')],
            [
              h.small([], ['WORKTREE']),
              h.strong([], ['web']),
              h.code([], ['localhost:4312']),
            ],
          ),
          h.div([h.Class('connector'), h.AriaHidden(true)]),
          h.div(
            [h.Class('worktree-card')],
            [
              h.small([], ['WORKTREE']),
              h.strong([], ['api']),
              h.code([], ['localhost:4311']),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('terminal')],
        [
          h.div(
            [h.Class('terminal-top')],
            [h.span([], ['stack-manager up']), h.span([], ['•••'])],
          ),
          terminalLine('ready', 'database', 'ready', h),
          terminalLine('ready', 'api', 'http ready', h),
          terminalLine('ready', 'web', 'http ready', h),
        ],
      ),
      h.figcaption([], ['Illustrative stack, not a live local session.']),
    ],
  )

const workflowCommand = (step: WorkflowStep): string =>
  WorkflowStep.match(step, {
    Configure: () => 'npm run cli -- add /path/to/project',
    Create: () => 'npm run cli -- create my-project --name review',
    Run: () => 'npm run cli -- start review --json',
  })

const workflowStatus = (step: WorkflowStep): string =>
  WorkflowStep.match(step, {
    Configure: () => 'Configuration reviewed',
    Create: () => 'Worktrees ready',
    Run: () => 'Stack running',
  })

const workflowButton = (
  label: string,
  step: WorkflowStep,
  selected: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.Class(selected ? 'workflow-button selected' : 'workflow-button'),
      h.AriaPressed(selected ? 'true' : 'false'),
      h.OnClick(Message.SelectedWorkflowStep({ step })),
    ],
    [label],
  )

const workflowView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const selectedTag = model.workflowStep._tag
  return h.section(
    [h.Class('workflow-section'), h.AriaLabelledBy('workflow-title')],
    [
      h.div(
        [h.Class('section-intro')],
        [
          h.p([h.Class('eyebrow')], ['A clear local workflow']),
          h.h2([h.Id('workflow-title')], ['From config to running stack']),
          h.p(
            [],
            [
              'Choose a step to see the command. This example is illustrative and does not control your machine.',
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('workflow-panel')],
        [
          h.div(
            [
              h.Class('workflow-tabs'),
              h.Role('group'),
              h.AriaLabel('Workflow steps'),
            ],
            [
              workflowButton(
                'Configure',
                WorkflowStep.Configure(),
                selectedTag === 'Configure',
                h,
              ),
              workflowButton(
                'Create',
                WorkflowStep.Create(),
                selectedTag === 'Create',
                h,
              ),
              workflowButton(
                'Run',
                WorkflowStep.Run(),
                selectedTag === 'Run',
                h,
              ),
            ],
          ),
          h.div(
            [h.Class('command-card'), h.AriaLive('polite'), h.Tabindex(0)],
            [
              h.span([h.Class('prompt'), h.AriaHidden(true)], ['$']),
              h.code([], [workflowCommand(model.workflowStep)]),
              h.span(
                [h.Class('command-status')],
                [workflowStatus(model.workflowStep)],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

const featureCard = (
  index: string,
  title: string,
  copy: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.article(
    [h.Class('feature-card')],
    [
      h.span([h.Class('feature-index')], [index]),
      h.h3([], [title]),
      h.p([], [copy]),
    ],
  )

const featuresView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [
      h.Id('features'),
      h.Class('features-section'),
      h.AriaLabelledBy('features-title'),
    ],
    [
      h.div(
        [h.Class('section-intro')],
        [
          h.p([h.Class('eyebrow')], ['One stack, many repositories']),
          h.h2(
            [h.Id('features-title')],
            ['Local environments without port roulette'],
          ),
        ],
      ),
      h.div(
        [h.Class('feature-grid')],
        [
          featureCard(
            '01',
            'Matching worktrees',
            'Create a named Git worktree for each configured repository and keep each task separate.',
            h,
          ),
          featureCard(
            '02',
            'Ports assigned together',
            'Claim a non-conflicting bundle of local ports and render them into each component environment.',
            h,
          ),
          featureCard(
            '03',
            'Start in dependency order',
            'Wait for process or HTTP readiness before starting components that depend on it.',
            h,
          ),
          featureCard(
            '04',
            'Provision by choice',
            'Copy private local files and optionally link shared directories such as node_modules.',
            h,
          ),
          featureCard(
            '05',
            'CLI and dashboard',
            'Run scripts in the terminal or inspect stacks, health, URLs and history in a loopback-only dashboard.',
            h,
          ),
          featureCard(
            '06',
            'Cleanup you approve',
            'Review exact cleanup steps and explicitly approve or skip destructive actions.',
            h,
          ),
        ],
      ),
    ],
  )

const homeView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [],
    [
      h.section(
        [h.Class('hero')],
        [
          h.div(
            [h.Class('hero-copy')],
            [
              h.p(
                [h.Class('eyebrow')],
                ['Configuration-driven local development'],
              ),
              h.h1(
                [],
                [
                  'One command.',
                  h.br([]),
                  h.span([], ['A whole working stack.']),
                ],
              ),
              h.p(
                [h.Class('hero-subline')],
                [
                  'Stack Manager creates matching Git worktrees, assigns ports and starts each component when its dependencies are ready.',
                ],
              ),
              h.div(
                [h.Class('hero-actions')],
                [
                  h.a(
                    [h.Href(quickstartRouter()), h.Class('button primary')],
                    ['Get started'],
                  ),
                  h.a(
                    [h.Href(GITHUB_URL), h.Class('button secondary')],
                    ['View on GitHub'],
                  ),
                ],
              ),
              h.p(
                [h.Class('source-note')],
                ['Runs locally. Source available on GitHub.'],
              ),
            ],
          ),
          stackVisualView(h),
        ],
      ),
      workflowView(model, h),
      featuresView(h),
      h.section(
        [h.Class('closing')],
        [
          h.p([h.Class('eyebrow')], ['Ready when your config is']),
          h.h2([], ['Give every task its own working stack.']),
          h.a(
            [h.Href(quickstartRouter()), h.Class('button primary')],
            ['Read the quickstart'],
          ),
        ],
      ),
    ],
  )

const codeBlock = (
  lines: ReadonlyArray<string>,
  h: HtmlBuilder<Message>,
): Html => h.pre([h.Tabindex(0)], [h.code([], [lines.join('\n')])])

const quickstartView = (h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('quickstart')],
    [
      h.header(
        [h.Class('page-heading')],
        [
          h.p([h.Class('eyebrow')], ['Quickstart']),
          h.h1([], ['Run your first stack']),
          h.p(
            [],
            [
              'Use Node.js 22.22.2 or newer. Clone Stack Manager, start its loopback dashboard, then register a project whose configuration you have reviewed.',
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('quickstart-grid')],
        [
          h.article(
            [],
            [
              h.span([h.Class('step-number')], ['01']),
              h.h2([], ['Install and start']),
              codeBlock(
                [
                  'git clone https://github.com/NigelThorne/stack-manager.git',
                  'cd stack-manager',
                  'npm install',
                  'npm start',
                ],
                h,
              ),
              h.p(
                [],
                [
                  'Open ',
                  h.code([], ['http://127.0.0.1:4310']),
                  ' for the local dashboard. Leave it running.',
                ],
              ),
            ],
          ),
          h.article(
            [],
            [
              h.span([h.Class('step-number')], ['02']),
              h.h2([], ['Add a reviewed config']),
              h.p(
                [],
                [
                  'In your project root, create ',
                  h.code([], ['.stack-manager.config']),
                  '. This example assumes a Git repository with an npm dev command that accepts --port. Install its dependencies in the main checkout first. The worktree shares that installation, so package manifests and lockfiles must match.',
                ],
              ),
              codeBlock(
                [
                  'export default {',
                  "  name: 'my-project',",
                  '  ports: { web: { base: 4311, step: 10 } },',
                  '  components: {',
                  '    web: {',
                  "      path: '.',",
                  "      worktree: { root: '../project.worktrees', branchPrefix: 'stack/', base: 'HEAD' },",
                  "      envFiles: { link: ['node_modules'] },",
                  "      command: ['npm', 'run', 'dev', '--', '--port', '{{ports.web}}'],",
                  "      ports: { http: 'web' },",
                  "      url: 'http://127.0.0.1:{{ports.web}}',",
                  "      readiness: { kind: 'http', port: 'web', path: '/', timeoutMs: 120000 }",
                  '    }',
                  '  }',
                  '}',
                ],
                h,
              ),
              h.p(
                [],
                [
                  'In a second terminal, return to the stack-manager checkout. Run this and the remaining CLI commands there:',
                ],
              ),
              codeBlock(['npm run cli -- add /path/to/project'], h),
            ],
          ),
          h.article(
            [],
            [
              h.span([h.Class('step-number')], ['03']),
              h.h2([], ['Create or run']),
              h.p(
                [],
                [
                  'Choose one option. Create worktrees without starting them, or create and start a new stack in one command. New worktrees use committed files, not uncommitted edits.',
                ],
              ),
              codeBlock(
                [
                  'npm run cli -- create my-project --name review',
                  '# OR create and start a new stack',
                  'npm run cli -- up my-project --name review --json',
                ],
                h,
              ),
              h.p(
                [],
                [
                  'If you chose create, start it with npm run cli -- start review --json. Stop it with npm run cli -- stop review --json. Do not install or change shared dependencies from a linked worktree.',
                ],
              ),
            ],
          ),
        ],
      ),
      h.aside(
        [h.Class('safety-note')],
        [
          h.h2([], ['Before cleanup']),
          h.p(
            [],
            [
              'The dashboard shows a cleanup plan with exact targets and warnings. Destructive delete steps require explicit approval. Conservative ',
              h.code([], ['cleanup']),
              ' can refuse changed or unmerged worktrees.',
            ],
          ),
        ],
      ),
      h.a([h.Href(homeRouter()), h.Class('back-link')], ['← Back to overview']),
    ],
  )

const notFoundView = (path: string, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('not-found')],
    [
      h.p([h.Class('eyebrow')], ['404']),
      h.h1([], ['That stack is not here.']),
      h.p([], [`No page exists at ${path}.`]),
      h.a([h.Href(homeRouter()), h.Class('button primary')], ['Back home']),
    ],
  )

const footerView = (h: HtmlBuilder<Message>): Html =>
  h.footer(
    [],
    [
      logoView(h),
      h.p([], ['A local development tool by Nigel Thorne.']),
      h.a([h.Href(GITHUB_URL)], ['GitHub source']),
    ],
  )

const routeMetadata = (route: AppRoute) =>
  AppRoute.match(route, {
    Home: () => ({
      title: 'Stack Manager | One command. A whole working stack.',
      description:
        'Create matching Git worktrees, assign local ports and start multi-repository development stacks in dependency order.',
      canonical: CANONICAL_ROOT,
    }),
    Quickstart: () => ({
      title: 'Quickstart | Stack Manager',
      description:
        'Install Stack Manager, register a reviewed project configuration and run your first local working stack.',
      canonical: `${CANONICAL_ROOT}/quickstart`,
    }),
    NotFound: () => ({
      title: 'Page not found | Stack Manager',
      description: 'The requested Stack Manager page could not be found.',
      canonical: `${CANONICAL_ROOT}/404`,
    }),
  })

export const descriptionForRoute = (route: AppRoute): string =>
  routeMetadata(route).description

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const metadata = routeMetadata(model.route)
  return {
    title: metadata.title,
    lang: 'en',
    canonical: metadata.canonical,
    ogUrl: metadata.canonical,
    body: h.div(
      [h.Class('site-shell')],
      [
        headerView(h),
        AppRoute.match(model.route, {
          Home: () => homeView(model, h),
          Quickstart: () => quickstartView(h),
          NotFound: ({ path }) => notFoundView(path, h),
        }),
        footerView(h),
      ],
    ),
  }
}
