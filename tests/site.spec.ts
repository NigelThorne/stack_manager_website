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
