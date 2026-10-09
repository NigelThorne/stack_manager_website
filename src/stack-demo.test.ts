import { describe, expect, test } from 'vitest'

import { Message, demoInit, demoUpdate, leaveDemo } from './stack-demo'

const next = (model: ReturnType<typeof demoInit>['model']) =>
  demoUpdate(model, Message.ClickedNext()).model

describe('stack lifecycle demo', () => {
  test('Next advances through completed lifecycle steps', () => {
    let model = demoInit().model

    model = next(model)
    expect(model.frame).toBe(1)
    model = next(model)
    expect(model.frame).toBe(2)
    model = next(model)
    expect(model.frame).toBe(5)
    model = next(model)
    expect(model.frame).toBe(8)
    model = next(model)
    expect(model.frame).toBe(10)
    model = next(model)

    expect(model.frame).toBe(11)
    expect(model.complete).toBe(true)
    expect(model.playing).toBe(false)
  })

  test('Pause invalidates an already scheduled tick', () => {
    const started = demoUpdate(
      demoInit().model,
      Message.ClickedPlayPause(),
    ).model
    const generation = started.generation
    const paused = demoUpdate(started, Message.ClickedPlayPause()).model
    const afterStaleTick = demoUpdate(
      paused,
      Message.CompletedDemoWait({ generation }),
    ).model

    expect(afterStaleTick).toEqual(paused)
  })

  test('Replay resets progress and starts one finite run', () => {
    const progressed = next(next(next(demoInit().model)))
    const replayed = demoUpdate(progressed, Message.ClickedReplay()).model

    expect(replayed.frame).toBe(0)
    expect(replayed.targetFrame).toBe(1)
    expect(replayed.typedLength).toBe(0)
    expect(replayed.playing).toBe(true)
    expect(replayed.complete).toBe(false)
  })

  test('leaving the route stops playback and rejects its pending tick', () => {
    const started = demoUpdate(
      demoInit().model,
      Message.ClickedPlayPause(),
    ).model
    const generation = started.generation
    const left = leaveDemo(started).model
    const afterStaleTick = demoUpdate(
      left,
      Message.CompletedDemoWait({ generation }),
    ).model

    expect(left.playing).toBe(false)
    expect(afterStaleTick).toEqual(left)
  })

  test('reduced motion completes command typing in one tick', () => {
    const reduced = demoUpdate(
      demoInit().model,
      Message.CompletedMotionPreferenceCheck({ reducedMotion: true }),
    ).model
    const started = demoUpdate(reduced, Message.ClickedPlayPause()).model
    const advanced = demoUpdate(
      started,
      Message.CompletedDemoWait({ generation: started.generation }),
    ).model

    expect(advanced.frame).toBe(0)
    expect(advanced.actionIndex).toBe(0)
    expect(advanced.typedLength).toBe('stack-manager add ./project'.length)
  })
})
