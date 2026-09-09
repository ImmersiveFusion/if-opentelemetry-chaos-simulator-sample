/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';

/**
 * Vitest driven through its own config with the AnalogJS Angular plugin, matching
 * the setup in IF.APM.App.Http.Spa rather than Angular's `@angular/build:unit-test`
 * builder, which is still marked [EXPERIMENTAL] in @angular/build 22.
 *
 * Two projects, because two kinds of test need two environments:
 *
 * - `unit` runs in jsdom. Fast, no browser, right for component and logic specs.
 *
 * - `browser` runs in real headless Chromium via Playwright, and exists because
 *   jsdom implements the SVG DOM but not SVG LAYOUT. Mermaid measures every node
 *   it lays out, so under jsdom every render throws "getBBox is not a function".
 *   A test that renders Mermaid in jsdom does not fail honestly, it throws inside
 *   whatever error handling the test has and passes having asserted nothing. That
 *   is how the first version of the XSS suite came to report 28 green checks over
 *   zero actual renders. Anything that renders a diagram belongs here.
 *
 * Notes carried over from the IF.APM config, both of which cost someone real time:
 *
 * 1. Do NOT set `pool: 'forks'`. AnalogJS initialises the Angular TestBed once per
 *    worker realm behind a globalThis symbol; with the forks pool that init does
 *    not reach the spec's execution context, and every spec fails with "Need to
 *    call TestBed.initTestEnvironment() first".
 *
 * 2. Do NOT add /@angular/ or /rxjs/ to `server.deps.inline`. The Analog plugin
 *    already transforms Angular. Force-inlining it makes vitest evaluate a second
 *    @angular/core instance, so the setup file and the specs end up on different
 *    TestBed singletons, with the same misleading error as above.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.browser.spec.ts'],
          reporters: ['default'],
        },
      },
      {
        test: {
          name: 'browser',
          globals: true,
          include: ['src/**/*.browser.spec.ts'],
          reporters: ['default'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'cobertura'],
      reportsDirectory: 'coverage',
      include: ['src/app/**/*.ts'],
      exclude: ['src/app/**/*.spec.ts', 'src/app/**/*.module.ts'],
    },
  },
});
