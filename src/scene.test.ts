import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Model, WorkflowStep, update, view } from './main'
import { AppRoute } from './route'

const homeModel = Model.make({
  route: AppRoute.Home(),
  workflowStep: WorkflowStep.Configure(),
})

const quickstartModel = Model.make({
  route: AppRoute.Quickstart(),
  workflowStep: WorkflowStep.Configure(),
})

describe('product site', () => {
  test('renders useful homepage content before interaction', () => {
    scene(
      { update, view },
      given(homeModel),
      expect(text('Develop in parallel.')).toExist(),
      expect(text('Review locally.')).toExist(),
      expect(role('link', { name: 'Get started' })).toExist(),
      expect(role('button', { name: 'Configure' })).toExist(),
      expect(text('npm run cli -- add /path/to/project')).toExist(),
    )
  })

  test('selecting a workflow step changes the illustrative command', () => {
    scene(
      { update, view },
      given(homeModel),
      click(role('button', { name: 'Create' })),
      expect(text('npm run cli -- create my-project --name review')).toExist(),
      expect(text('Worktrees ready')).toExist(),
    )
  })

  test('renders the quickstart with local install commands', () => {
    scene(
      { update, view },
      given(quickstartModel),
      expect(role('heading', { name: 'Run your first stack' })).toExist(),
      expect(text(/npm install/)).toExist(),
      expect(text(/npm start/)).toExist(),
      expect(text('http://127.0.0.1:4310')).toExist(),
      expect(
        text(/npm run cli -- up my-project --name review --json/),
      ).toExist(),
    )
  })
})
