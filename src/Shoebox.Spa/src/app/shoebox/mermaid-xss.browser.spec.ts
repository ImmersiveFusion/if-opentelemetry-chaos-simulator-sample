import { decorate } from './diagram-style';

/**
 * Shoebox renders a user-supplied Mermaid diagram and writes the resulting SVG
 * straight into `innerHTML` (shoebox.component.ts, in `render()`). The diagram is
 * fully untrusted: the whole point of the tool is that a stranger pastes one in,
 * and share links carry a diagram in the URL.
 *
 * That is safe today, but only because of a configuration line far away from the
 * sink. Mermaid runs DOMPurify over the entire serialised SVG before returning it,
 * on every security level except 'loose' (mermaid.core.mjs, the
 * `else if (!isLooseSecurityLevel)` branch). Flip `securityLevel` to 'loose' one
 * afternoon to get some feature working and the sink becomes genuinely exploitable,
 * silently, with nothing to tell you.
 *
 * CodeQL flags the sink (js/xss-through-dom) because it cannot see the sanitiser
 * inside the dependency. Rather than suppress that on a promise, this file turns
 * the promise into a test.
 *
 * ---
 *
 * THIS FILE MUST RUN IN A REAL BROWSER. It is `.browser.spec.ts` on purpose.
 *
 * jsdom implements the SVG DOM but not SVG layout, and Mermaid measures every node
 * it lays out, so under jsdom every single render throws "getBBox is not a
 * function". The first version of this suite ran under jsdom, swallowed those
 * throws, and reported 28 passing assertions over ZERO actual renders. Hence the
 * rendered-count guard at the bottom: the suite is now required to prove it did
 * real work, not merely to avoid finding anything.
 */

const SHOEBOX_MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict' as const,
  theme: 'base' as const,
};

/** Markup that must never survive into the DOM, whatever the input. */
const DANGEROUS = [
  { name: 'script tag', pattern: /<script/i },
  { name: 'event handler attribute', pattern: /\son[a-z]+\s*=/i },
  { name: 'javascript: URL', pattern: /javascript:/i },
  { name: 'iframe', pattern: /<iframe/i },
  { name: 'object', pattern: /<object/i },
  { name: 'embed', pattern: /<embed/i },
  { name: 'form', pattern: /<form/i },
];

/**
 * Every one of these is a real attempt, not a placeholder. They cover the label
 * paths (plain, edge, v11 `@{ }` shape syntax, markdown-string), the click
 * directive, the KaTeX math path that CVE-2025-54881 exploited, and an attempt to
 * turn off the very protection being relied on.
 */
const ATTACKS: { name: string; diagram: string }[] = [
  {
    name: 'node label, img onerror',
    diagram: 'flowchart LR\n  A["<img src=x onerror=alert(1)>"] --> B[ok]',
  },
  {
    name: 'node label, script tag',
    diagram: 'flowchart LR\n  A["<script>alert(document.domain)</script>"] --> B[end]',
  },
  {
    name: 'edge label, img onerror',
    diagram: 'flowchart LR\n  A --> |"<img src=x onerror=alert(2)>"| B',
  },
  {
    name: 'svg onload',
    diagram: 'flowchart LR\n  A["<svg onload=alert(3)>"] --> B',
  },
  {
    name: 'click directive, javascript: URI',
    diagram: 'flowchart LR\n  A[Node] --> B[Node2]\n  click A "javascript:alert(4)" "tooltip"',
  },
  {
    name: 'click directive, callback form',
    diagram: 'flowchart LR\n  A[Node]\n  click A call alert("xss5")',
  },
  {
    name: 'v11 shape-data label',
    diagram: 'flowchart LR\n  A@{ shape: rect, label: "<img src=x onerror=alert(6)>" } --> B',
  },
  {
    name: 'markdown-string label',
    diagram: 'flowchart LR\n  A["`**bold** <img src=x onerror=alert(7)>`"] --> B',
  },
  {
    name: 'KaTeX math label (CVE-2025-54881 shape)',
    diagram:
      'sequenceDiagram\n  participant A\n  participant B\n  A->>B: $$\\text{<img src=x onerror=alert(8)>}$$',
  },
  {
    name: 'style tag injection',
    diagram:
      "flowchart LR\n  A[\"<style>*{background:url('https://evil.example/exfil')}</style>\"] --> B",
  },
  {
    name: 'foreignObject namespace confusion',
    diagram: 'flowchart LR\n  A["<foreignObject><script>alert(9)</script></foreignObject>"] --> B',
  },
  {
    name: 'raw anchor with javascript: href',
    diagram: 'flowchart LR\n  A["<a href=\'javascript:alert(10)\'>click me</a>"] --> B',
  },
  {
    name: 'case-obfuscated handlers',
    diagram:
      'flowchart LR\n  A["<img src=x OnErRor=alert(11)>"] --> B\n  C["<svg/onload=alert(12)>"] --> D',
  },
  {
    name: 'embedded init directive trying to disable strict mode',
    diagram:
      '%%{init: {"securityLevel": "loose", "flowchart": {"htmlLabels": true}}}%%\nflowchart LR\n  A["<img src=x onerror=alert(13)>"] --> B',
  },
];

type RenderOutcome = { status: 'rendered'; svg: string } | { status: 'rejected'; message: string };

/** Counts real renders across the suite, so vacuous passes are detectable. */
let renderedCount = 0;

/**
 * Mermaid's parser legitimately rejects some hostile input outright, and that is a
 * fine outcome: what never reaches `render()` never reaches `innerHTML`. But an
 * environment failure (the jsdom getBBox case) must NOT be quietly treated the
 * same way, because that is precisely how this suite once passed while doing
 * nothing. Anything that is not recognisably a parse rejection is rethrown.
 */
async function render(
  mermaid: typeof import('mermaid').default,
  id: string,
  diagram: string,
): Promise<RenderOutcome> {
  try {
    const { svg } = await mermaid.render(id, diagram);
    renderedCount++;
    return { status: 'rendered', svg };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/parse|syntax|expecting/i.test(message)) {
      return { status: 'rejected', message };
    }
    throw new Error(
      'render() failed for a reason that is not a parse rejection, so this test would ' +
        `otherwise pass without asserting anything: ${message}`,
    );
  }
}

function expectInert(svg: string, label: string): void {
  for (const { name, pattern } of DANGEROUS) {
    expect(svg, `${label} leaked ${name}`).not.toMatch(pattern);
  }
}

describe('mermaid render output reaching innerHTML', () => {
  let mermaid: typeof import('mermaid').default;

  beforeAll(async () => {
    mermaid = (await import('mermaid')).default;
  });

  beforeEach(() => {
    mermaid.initialize(SHOEBOX_MERMAID_CONFIG);
  });

  ATTACKS.forEach((attack, i) => {
    it(`neutralises: ${attack.name}`, async () => {
      const out = await render(mermaid, `xss-raw-${i}`, attack.diagram);
      if (out.status === 'rendered') expectInert(out.svg, attack.name);
    });

    it(`neutralises through decorate(): ${attack.name}`, async () => {
      // decorate() is the real code path the component uses. It is regex-based and
      // fails open, so it should not change the outcome, but "should not" is what
      // tests are for.
      const out = await render(mermaid, `xss-dec-${i}`, decorate(attack.diagram));
      if (out.status === 'rendered') expectInert(out.svg, `${attack.name} (decorated)`);
    });
  });

  it('inserts inertly into a live DOM', async () => {
    const out = await render(
      mermaid,
      'xss-dom',
      'flowchart LR\n  A["<img src=x onerror=\'window.__shoeboxPwned = true\'>"] --> B[ok]',
    );
    expect(out.status, 'the DOM check needs a real render to mean anything').toBe('rendered');

    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      host.innerHTML = (out as { svg: string }).svg;
      // Give an injected handler the chance to fire before asserting it did not.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect((window as unknown as Record<string, unknown>)['__shoeboxPwned']).toBeUndefined();
      expect(host.querySelector('script')).toBeNull();
      expect(host.innerHTML.length, 'nothing was actually inserted').toBeGreaterThan(0);
    } finally {
      host.remove();
    }
  });

  /**
   * Label sanitisation does NOT depend on securityLevel, and this test pins that.
   *
   * This started life as a tripwire asserting the opposite: that 'loose' would leak,
   * proving the suite was sensitive to the setting. It failed, and the reason is
   * worth keeping. In `sanitizeText` (chunk-DU6HZSFF.mjs) Mermaid runs
   * `DOMPurify.sanitize(sanitizeMore(text, config), { FORBID_TAGS: ['style'] })`
   * UNCONDITIONALLY. `securityLevel` only selects how much extra escaping
   * `sanitizeMore` layers on top; it never switches the DOMPurify pass off for
   * labels. The whole-SVG pass at mermaid.core.mjs is a second, separate layer that
   * 'loose' does skip.
   *
   * So label text is sanitised at every security level, which makes the CodeQL
   * finding a firmer false positive than "it depends on staying strict" would
   * suggest.
   *
   * If this test ever FAILS, that unconditional pass has gone, and the sink at
   * shoebox.component.ts really is exposed. Do not relax it; re-read the analysis.
   */
  it('neutralises label vectors even with securityLevel loose', async () => {
    mermaid.initialize({ ...SHOEBOX_MERMAID_CONFIG, securityLevel: 'loose' });
    const out = await render(
      mermaid,
      'xss-loose',
      'flowchart LR\n  A["<img src=x onerror=alert(1)>"] --> B[ok]',
    );

    expect(out.status, 'this assertion needs a real render to mean anything').toBe('rendered');
    expectInert((out as { svg: string }).svg, 'loose-mode label');
  });

  /**
   * The guard that would have caught the original mistake. Under jsdom this suite
   * reported 28 passes with renderedCount === 0.
   */
  it('actually rendered the attack diagrams', () => {
    expect(
      renderedCount,
      'almost nothing rendered, so the assertions above proved almost nothing; ' +
        'this suite must run in a real browser (see the file header)',
    ).toBeGreaterThanOrEqual(20);
  });
});
