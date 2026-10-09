import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { type Html, type HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

export const Model = Schema.Struct({
  frame: Schema.Number,
  targetFrame: Schema.Number,
  typedLength: Schema.Number,
  actionIndex: Schema.Number,
  playing: Schema.Boolean,
  complete: Schema.Boolean,
  reducedMotion: Schema.Boolean,
  generation: Schema.Number,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedPlayPause: {},
  ClickedNext: {},
  ClickedReplay: {},
  CompletedDemoWait: { generation: Schema.Number },
  CompletedMotionPreferenceCheck: { reducedMotion: Schema.Boolean },
})
export type Message = typeof Message.Type

const MAJOR_FRAMES = [1, 2, 5, 8, 10, 11] as const
const ACTIONS: Readonly<Record<number, ReadonlyArray<string>>> = {
  1: ['Reading the project config.', 'Registering the shop project.'],
  2: [
    'Allocating ports for search-ui.',
    'Creating the backend worktree.',
    'Creating the frontend worktree.',
  ],
  5: ['Starting search-ui in dependency order.'],
  8: [
    'Allocating separate ports for checkout-fix.',
    'Creating its backend worktree.',
    'Creating its frontend worktree.',
  ],
  10: [
    'Simulated: the search-ui backend stops responding.',
    'Checking the backend and frontend.',
  ],
  11: [
    'Simulated: the backend responds again.',
    'Checking the backend and frontend again.',
  ],
}

const COMMANDS: Readonly<Record<number, string>> = {
  1: 'stack-manager add ./project',
  2: 'stack-manager create shop --name search-ui',
  5: 'stack-manager start search-ui',
  8: 'stack-manager up shop --name checkout-fix',
  10: 'stack-manager health search-ui',
  11: 'stack-manager health search-ui',
}

export const demoInit = (): {
  model: Model
  commands: ReadonlyArray<Command.Command<Message>>
} => ({
  model: Model.make({
    frame: 0,
    targetFrame: 1,
    typedLength: 0,
    actionIndex: -1,
    playing: false,
    complete: false,
    reducedMotion: false,
    generation: 0,
  }),
  commands: [CheckMotionPreference()],
})

const CheckMotionPreference = Command.define('CheckMotionPreference', {
  messages: [Message.CompletedMotionPreferenceCheck],
  execute: Effect.sync(() =>
    Message.CompletedMotionPreferenceCheck({
      reducedMotion:
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }),
  ).pipe(
    Effect.catch(() =>
      Effect.succeed(
        Message.CompletedMotionPreferenceCheck({ reducedMotion: false }),
      ),
    ),
  ),
})

const WaitForDemo = Command.define('WaitForDemo', {
  args: { generation: Schema.Number, delay: Schema.Number },
  messages: [Message.CompletedDemoWait],
  execute: ({ generation, delay }) =>
    Effect.sleep(`${delay} millis`).pipe(
      Effect.as(Message.CompletedDemoWait({ generation })),
      Effect.catch(() =>
        Effect.succeed(Message.CompletedDemoWait({ generation })),
      ),
    ),
})

const wait = (model: Model, delay = 42): Command.Command<Message> =>
  WaitForDemo({ generation: model.generation, delay })

const nextMajorFrame = (frame: number): number =>
  MAJOR_FRAMES.find(candidate => candidate > frame) ?? MAJOR_FRAMES.at(-1)!

const commandFor = (model: Model): string => COMMANDS[model.targetFrame] ?? ''

type DemoUpdateReturn = Update.Return<Model, Message>

const beginNextStep = (model: Model, playing: boolean): DemoUpdateReturn => {
  const targetFrame = nextMajorFrame(model.frame)
  const nextModel = modifyFields(model, {
    targetFrame: () => targetFrame,
    typedLength: () => 0,
    actionIndex: () => -1,
    playing: () => playing,
    complete: () => false,
    generation: generation => generation + 1,
  })
  return playing
    ? { model: nextModel, commands: [wait(nextModel)] }
    : { model: nextModel }
}

export const demoUpdate = (model: Model, message: Message) =>
  Message.match<DemoUpdateReturn>(message, {
    ClickedPlayPause: () => {
      if (model.complete) return { model }
      if (model.playing) {
        return {
          model: modifyFields(model, {
            playing: () => false,
            generation: generation => generation + 1,
          }),
        }
      }
      const nextModel = modifyFields(model, {
        playing: () => true,
        generation: generation => generation + 1,
      })
      return { model: nextModel, commands: [wait(nextModel)] }
    },
    ClickedNext: () => {
      if (model.complete) return { model }
      const targetFrame = nextMajorFrame(model.frame)
      const complete = targetFrame === MAJOR_FRAMES.at(-1)
      return {
        model: modifyFields(model, {
          frame: () => targetFrame,
          targetFrame: () => targetFrame,
          typedLength: () => (COMMANDS[targetFrame] ?? '').length,
          actionIndex: () => (ACTIONS[targetFrame] ?? []).length,
          playing: () => false,
          complete: () => complete,
          generation: generation => generation + 1,
        }),
      }
    },
    ClickedReplay: () => {
      const replay = demoInit().model
      const nextModel = modifyFields(replay, {
        reducedMotion: () => model.reducedMotion,
        playing: () => true,
        generation: () => model.generation + 1,
      })
      return { model: nextModel, commands: [wait(nextModel)] }
    },
    CompletedDemoWait: ({ generation }) => {
      if (!model.playing || generation !== model.generation || model.complete) {
        return { model }
      }
      const command = commandFor(model)
      if (!model.reducedMotion && model.typedLength < command.length) {
        const nextModel = modifyFields(model, {
          typedLength: length => length + 1,
        })
        return { model: nextModel, commands: [wait(nextModel)] }
      }
      const actions = ACTIONS[model.targetFrame] ?? []
      if (model.actionIndex < actions.length - 1) {
        const nextModel = modifyFields(model, {
          typedLength: () => command.length,
          actionIndex: index => index + 1,
        })
        return { model: nextModel, commands: [wait(nextModel, 1600)] }
      }
      if (model.frame < model.targetFrame) {
        const nextFrame = model.frame + 1
        const complete = nextFrame === MAJOR_FRAMES.at(-1)
        const nextModel = modifyFields(model, {
          frame: () => nextFrame,
          actionIndex: () => actions.length,
          typedLength: () => command.length,
          playing: () => !complete,
          complete: () => complete,
        })
        if (complete) return { model: nextModel }
        return { model: nextModel, commands: [wait(nextModel, 1600)] }
      }
      return beginNextStep(model, true)
    },
    CompletedMotionPreferenceCheck: ({ reducedMotion }) => ({
      model: modifyFields(model, { reducedMotion: () => reducedMotion }),
    }),
  })

export const leaveDemo = (model: Model): DemoUpdateReturn => ({
  model: modifyFields(model, {
    playing: () => false,
    generation: generation => generation + 1,
  }),
})

interface ServiceState {
  readonly name: string
  readonly port: string
  readonly status: 'Stopped' | 'Starting' | 'Healthy' | 'Unhealthy'
}

interface StackState {
  readonly name: string
  readonly status: ServiceState['status']
  readonly services: ReadonlyArray<ServiceState>
}

const stacksForFrame = (frame: number): ReadonlyArray<StackState> => {
  const first: StackState = {
    name: 'search-ui',
    status:
      frame >= 10
        ? frame >= 11
          ? 'Healthy'
          : 'Unhealthy'
        : frame >= 5
          ? 'Healthy'
          : frame >= 3
            ? 'Starting'
            : 'Stopped',
    services: [
      {
        name: 'Frontend',
        port: ':4312',
        status: frame >= 5 ? 'Healthy' : frame >= 4 ? 'Starting' : 'Stopped',
      },
      {
        name: 'Backend',
        port: ':4311',
        status:
          frame >= 10
            ? frame >= 11
              ? 'Healthy'
              : 'Unhealthy'
            : frame >= 4
              ? 'Healthy'
              : frame >= 3
                ? 'Starting'
                : 'Stopped',
      },
    ],
  }
  if (frame < 2) return []
  if (frame < 6) return [first]
  const second: StackState = {
    name: 'checkout-fix',
    status: frame >= 8 ? 'Healthy' : 'Starting',
    services: [
      {
        name: 'Frontend',
        port: ':4332',
        status: frame >= 8 ? 'Healthy' : frame >= 7 ? 'Starting' : 'Stopped',
      },
      {
        name: 'Backend',
        port: ':4331',
        status: frame >= 7 ? 'Healthy' : 'Starting',
      },
    ],
  }
  return [first, second]
}

const captionForFrame = (frame: number): string => {
  if (frame === 0) return 'Ready to register the shop project.'
  if (frame === 1)
    return 'Project shop registered. No stack has been created yet.'
  if (frame === 2)
    return 'Worktrees and ports are ready. Services are not running yet.'
  if (frame === 3)
    return 'The backend starts first. The frontend waits until it is ready.'
  if (frame === 4) return 'The backend is ready. Now the frontend starts.'
  if (frame === 5) return 'search-ui is healthy from frontend to backend.'
  if (frame < 8)
    return 'checkout-fix gets its own worktrees and ports before startup.'
  if (frame === 8) return 'Both stacks are healthy and run independently.'
  if (frame === 9)
    return 'Simulated failure: the search-ui backend stops responding. The next result reports its health.'
  if (frame === 10)
    return 'The health check observes the simulated backend failure. It does not cause or repair it.'
  return 'The backend responds again. The health check confirms recovery; it did not repair the service.'
}

const statusClass = (status: ServiceState['status']): string =>
  status.toLowerCase()

const statusView = <Message>(
  status: ServiceState['status'],
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.Class(`demo-status ${statusClass(status)}`)],
    [h.span([h.Class('status-bulb'), h.AriaHidden(true)]), status],
  )

const serviceView = <Message>(
  service: ServiceState,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('stack-service')],
    [
      h.span([], [service.name]),
      h.code([], [service.port]),
      statusView(service.status, h),
    ],
  )

const stackView = <Message>(stack: StackState, h: HtmlBuilder<Message>): Html =>
  h.keyed('div')(
    stack.name,
    [h.Class('worktree-card')],
    [
      h.div(
        [h.Class('stack-card-heading')],
        [h.strong([], [stack.name]), statusView(stack.status, h)],
      ),
      serviceView(stack.services[0]!, h),
      h.div([h.Class('connector'), h.AriaHidden(true)]),
      serviceView(stack.services[1]!, h),
      h.small([], ['Services connect only inside this stack']),
    ],
  )

const pendingStackView = <Message>(
  second: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('worktree-card pending-stack')],
    [
      h.div(
        [h.Class('stack-card-heading')],
        [
          h.strong([], [second ? 'checkout-fix' : 'search-ui']),
          h.span(
            [h.Class('demo-status starting')],
            [h.span([h.Class('status-bulb'), h.AriaHidden(true)]), 'Preparing'],
          ),
        ],
      ),
      h.p([], ['Ports allocated']),
      h.code([], [second ? 'Frontend :4332' : 'Frontend :4312']),
      h.code([], [second ? 'Backend :4331' : 'Backend :4311']),
      h.p([], ['Creating worktrees before starting services.']),
    ],
  )

export const demoView = <ParentMessage>(
  model: Model,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const command = commandFor(model)
  const displayedCommand = command.slice(
    0,
    model.reducedMotion ? command.length : model.typedLength,
  )
  const progress = MAJOR_FRAMES.filter(frame => frame <= model.frame).length
  const stacks = stacksForFrame(model.frame)
  const actions = ACTIONS[model.targetFrame] ?? []
  const applying = model.actionIndex >= 0 && model.actionIndex < actions.length
  const preparingStack =
    applying &&
    model.actionIndex >= 1 &&
    (model.targetFrame === 2 || model.targetFrame === 8)
  return h.figure(
    [
      h.Class('stack-visual'),
      h.AriaLabel('Animated demonstration of two independent local stacks'),
    ],
    [
      h.div(
        [h.Class('visual-toolbar')],
        [
          h.span([], [`Step ${progress} of ${MAJOR_FRAMES.length}`]),
          h.span(
            [],
            [
              model.complete
                ? 'Demo complete'
                : model.playing
                  ? 'Playing'
                  : 'Paused',
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class('demo-controls'),
          h.Role('group'),
          h.AriaLabel('Demo controls'),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.OnClick(toParentMessage(Message.ClickedPlayPause())),
              h.Disabled(model.complete),
            ],
            [model.playing ? 'Pause demo' : 'Play demo'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(toParentMessage(Message.ClickedNext())),
              h.Disabled(model.complete),
            ],
            ['Next step'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(toParentMessage(Message.ClickedReplay())),
            ],
            ['Replay demo'],
          ),
        ],
      ),
      h.div(
        [
          h.Class('demo-terminal'),
          h.Tabindex(0),
          h.AriaLabel('Illustrative command. No commands are executed.'),
        ],
        [
          h.span([h.Class('prompt'), h.AriaHidden(true)], ['$']),
          h.code([], [displayedCommand || 'Press Play or Next']),
          model.actionIndex >= 0
            ? h.span([h.Class('command-enter'), h.AriaHidden(true)], ['↵'])
            : h.empty,
          !model.reducedMotion &&
          model.playing &&
          model.typedLength < command.length
            ? h.span([h.Class('typing-cursor'), h.AriaHidden(true)], ['_'])
            : h.empty,
        ],
      ),
      model.frame >= 1
        ? h.p([h.Class('project-state')], ['Project shop registered'])
        : h.empty,
      h.div(
        [h.Class('worktree-row')],
        [
          ...stacks.map(stack => stackView(stack, h)),
          preparingStack
            ? pendingStackView(model.targetFrame === 8, h)
            : h.empty,
          stacks.length === 0 && !preparingStack
            ? h.p(
                [h.Class('empty-demo')],
                [applying ? actions[model.actionIndex]! : 'No stacks created'],
              )
            : h.empty,
        ],
      ),
      h.figcaption(
        [h.AriaLive('polite')],
        [applying ? actions[model.actionIndex]! : captionForFrame(model.frame)],
      ),
      h.p(
        [h.Class('demo-disclaimer')],
        ['Illustrative demo. No commands are executed.'],
      ),
    ],
  )
}
