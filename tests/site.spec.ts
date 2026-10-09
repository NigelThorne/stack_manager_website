import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const origin = 'https://stackmanager.nigelthorne.com'

test('serves useful generated HTML and real missing-page status without JavaScript', async ({
  request,
  browser,
}) => {
  for (const path of ['/', '/quickstart']) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<h1')
    expect(html).toContain('data-foldkit-app')
    expect(html).toContain('Stack Manager')
    expect(html).toContain('name="description"')
    expect(html).toContain(`${origin}${path === '/' ? '' : path}`)
  }
  const home = await (await request.get('/')).text()
  for (const copy of [
    'Develop in parallel.',
    'Review locally.',
    'before you share it',
    'Share the big folders',
    'node_modules',
    'Choose flags per stack',
    'Allocate and manage ports',
    'Check service health',
    'HTTP readiness checks',
    'A tool your AI can use',
    'CLI and read JSON results',
    'Git worktrees',
    'monorepo',
    'Tested with Firebase',
  ]) {
    expect(home).toContain(copy)
  }
  expect((await request.get('/this-page-does-not-exist')).status()).toBe(404)
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto(`${test.info().project.use.baseURL}/`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page
    .getByRole('link', { name: /get started/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/quickstart\/?$/)
  await expect(page.locator('main')).toContainText('git clone')
  await context.close()
})

test('shows independent end-to-end stacks and explains port setup', async ({
  page,
}) => {
  await page.goto('/')
  const stacks = page.locator('.worktree-row > .worktree-card')
  const next = page.getByRole('button', { name: 'Next step', exact: true })
  await expect(stacks).toHaveCount(0)
  await next.click()
  await expect(page.locator('.project-state')).toHaveText(
    'Project shop registered',
  )
  await expect(stacks).toHaveCount(0)
  await next.click()
  await expect(stacks).toHaveCount(1)
  await expect(stacks.first().locator('.demo-status.stopped')).toHaveCount(3)
  await expect(stacks.first()).toContainText(':4311')
  await expect(stacks.first()).toContainText(':4312')
  await next.click()
  await expect(stacks.first().locator('.demo-status.healthy')).toHaveCount(3)
  await next.click()
  await expect(stacks).toHaveCount(2)
  await expect(stacks.last()).toContainText(':4331')
  await expect(stacks.last()).toContainText(':4332')
  await expect(page.locator('.worktree-row > .connector')).toHaveCount(0)
  for (const stack of await stacks.all()) {
    await expect(stack.locator('.stack-service')).toHaveCount(2)
    await expect(stack.locator('.connector')).toHaveCount(1)
    await expect(stack).toContainText('Frontend')
    await expect(stack).toContainText('Backend')
  }
  await next.click()
  await expect(stacks.first().locator('.demo-status.unhealthy')).toHaveCount(2)
  await expect(stacks.last().locator('.demo-status.healthy')).toHaveCount(3)
  await expect(page.locator('.stack-visual figcaption')).toContainText(
    'observes the simulated backend failure',
  )
  await next.click()
  await expect(page.locator('.demo-status.healthy')).toHaveCount(6)
  await expect(next).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Play demo', exact: true }),
  ).toBeDisabled()
  await expect(page.locator('.stack-visual figcaption')).toContainText(
    'did not repair the service',
  )
  await expect(
    page.getByRole('heading', { name: 'Allocate and manage ports' }),
  ).toBeVisible()
  await expect(
    page.getByText(/You must configure your services to use those ports/),
  ).toBeVisible()
})

test('demo types, pauses, replays, finishes and stops when leaving the page', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('[data-foldkit-build]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Play demo', exact: true }).click()
  await page.clock.runFor(250)
  const partial = await page.locator('.demo-terminal code').textContent()
  expect(partial).toBeTruthy()
  expect(partial!.length).toBeLessThan('stack-manager add ./project'.length)
  await page.getByRole('button', { name: 'Pause demo' }).click()
  const paused = await page.locator('.demo-terminal code').textContent()
  await page.clock.runFor(2000)
  await expect(page.locator('.demo-terminal code')).toHaveText(paused!)
  await page.getByRole('button', { name: 'Replay demo' }).click()
  await page.clock.runFor(1200)
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager add ./project',
  )
  await expect(page.locator('.stack-visual figcaption')).toHaveText(
    'Reading the project config.',
  )
  await expect(page.locator('.project-state')).toHaveCount(0)
  await page.clock.runFor(4000)
  await expect(page.locator('.project-state')).toBeVisible()
  await expect(page.locator('.worktree-card')).toHaveCount(0)
  await page.clock.runFor(90000)
  await expect(page.locator('.visual-toolbar')).toContainText('Demo complete')
  await expect(page.locator('.demo-status.healthy')).toHaveCount(6)
  await page.getByRole('button', { name: 'Replay demo' }).click()
  await page.getByRole('link', { name: 'Get started', exact: true }).click()
  await page.clock.runFor(5000)
  await page.getByRole('link', { name: 'Stack Manager home' }).first().click()
  await expect(
    page.getByRole('button', { name: 'Play demo', exact: true }),
  ).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Pause demo' })).toHaveCount(0)
})

test('reduced motion skips typing but leaves time to read each state', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager add ./project',
  )
  await page.getByRole('button', { name: 'Play demo', exact: true }).click()
  await page.clock.runFor(100)
  await expect(page.locator('.stack-visual figcaption')).toHaveText(
    'Reading the project config.',
  )
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager add ./project',
  )
  await page.clock.runFor(900)
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager add ./project',
  )
  await expect(page.locator('.typing-cursor')).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause demo' }).click()
})

test('submitted commands apply ports, worktrees and service startup in readable stages', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager add ./project',
  )
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await page.getByRole('button', { name: 'Play demo', exact: true }).click()
  await page.clock.runFor(150)
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager create shop --name search-ui',
  )
  await expect(page.locator('.stack-visual figcaption')).toHaveText(
    'Allocating ports for search-ui.',
  )
  await expect(page.locator('.worktree-card')).toHaveCount(0)
  await page.clock.runFor(1650)
  await expect(page.locator('.pending-stack')).toContainText('Ports allocated')
  await expect(page.locator('.stack-service')).toHaveCount(0)
  await page.clock.runFor(1650)
  await expect(page.locator('.stack-visual figcaption')).toHaveText(
    'Creating the frontend worktree.',
  )
  await page.clock.runFor(1650)
  await expect(page.locator('.pending-stack')).toHaveCount(0)
  await expect(page.locator('.demo-status.stopped')).toHaveCount(3)
  await page.clock.runFor(1650)
  await expect(page.locator('.demo-terminal code')).toHaveText(
    'stack-manager start search-ui',
  )
  await expect(page.locator('.demo-status.stopped')).toHaveCount(3)
  await page.clock.runFor(1650)
  await expect(
    page
      .locator('.stack-service')
      .filter({ hasText: 'Backend' })
      .locator('.demo-status'),
  ).toHaveText('Starting')
  await expect(
    page
      .locator('.stack-service')
      .filter({ hasText: 'Frontend' })
      .locator('.demo-status'),
  ).toHaveText('Stopped')
  await page.clock.runFor(1650)
  await expect(
    page
      .locator('.stack-service')
      .filter({ hasText: 'Backend' })
      .locator('.demo-status'),
  ).toHaveText('Healthy')
  await expect(
    page
      .locator('.stack-service')
      .filter({ hasText: 'Frontend' })
      .locator('.demo-status'),
  ).toHaveText('Starting')
  await page.clock.runFor(1650)
  await expect(page.locator('.demo-status.healthy')).toHaveCount(3)
  await page.getByRole('button', { name: 'Pause demo' }).click()
})

test('page navigation starts at the top, and Features navigates to its section', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page
    .getByRole('link', { name: 'Read the quickstart', exact: true })
    .click()
  await expect(page).toHaveURL(/\/quickstart\/?$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('main pre').first()).toBeFocused()
  await page.getByRole('link', { name: 'Features', exact: true }).click()
  await expect(page).toHaveURL(/\/#features$/)
  await expect(
    page.getByRole('heading', {
      name: 'Separate changes. Working stacks.',
    }),
  ).toBeInViewport()
  await expect(page.locator('#features-title')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Read the quickstart', exact: true }),
  ).toBeFocused()
})

test('hydrates fresh pages and keeps internal and external links usable', async ({
  page,
}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (
      message.type() === 'warning' &&
      /hydrat|mismatch/i.test(message.text())
    ) {
      errors.push(message.text())
    }
  })
  await page.goto('/')
  await expect(page.locator('.site-shell')).toBeVisible()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Create', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.command-card')).toContainText('create my-project')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.locator('.command-card')).toContainText('start review')
  await expect(
    page.locator('[data-foldkit-build], [data-foldkit-refused]'),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /github/i }).first(),
  ).toHaveAttribute('href', 'https://github.com/NigelThorne/stack-manager')
  await page
    .getByRole('link', { name: /get started/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/quickstart\/?$/)
  await expect(page.locator('main')).toContainText('npm install')
  await page.reload()
  await expect(
    page.locator('[data-foldkit-build], [data-foldkit-refused]'),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const width of [1440, 390, 320]) {
  test(`readable layout at ${width}px and reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('[data-foldkit-build]')).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const heading = await page
      .getByRole('heading', { level: 1 })
      .evaluate(element => {
        const style = getComputedStyle(element)
        return {
          weight: Number(style.fontWeight),
          tracking: parseFloat(style.letterSpacing) || 0,
        }
      })
    expect(heading.weight).toBeLessThanOrEqual(500)
    expect(heading.tracking).toBeGreaterThanOrEqual(0)
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(animation => animation.playState === 'running').length,
      ),
    ).toBe(0)
    for (let step = 0; step < 5; step++) {
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
    }
    await expect(page.locator('.worktree-card')).toHaveCount(2)
    await expect(page.locator('.demo-status.unhealthy')).toHaveCount(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      accessibility.violations.map(item => ({
        id: item.id,
        targets: item.nodes.map(node => node.target),
      })),
    ).toEqual([])
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    })
    await page.goto('/quickstart')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const quickstartAccessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      quickstartAccessibility.violations.map(item => ({
        id: item.id,
        targets: item.nodes.map(node => node.target),
      })),
    ).toEqual([])
  })
}
