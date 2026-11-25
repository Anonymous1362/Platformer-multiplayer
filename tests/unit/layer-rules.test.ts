import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cruise, type ICruiseResult, type IForbiddenRuleType } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

/**
 * Proves the layer rules actually fire (regression: an `exclude` of node_modules once hid every
 * package import from every rule, so a Phaser import in src/core passed `deps:check`).
 */
const require = createRequire(import.meta.url);
const config = require('../../.dependency-cruiser.cjs') as {
  forbidden: IForbiddenRuleType[];
  options: { exclude: { path: string } };
};
const canaryDir = fileURLToPath(new URL('../fixtures/layer-canary/', import.meta.url));

async function violations(): Promise<Map<string, string[]>> {
  const result = await cruise(['src'], {
    baseDir: canaryDir,
    ruleSet: { forbidden: config.forbidden },
    doNotFollow: { path: 'node_modules' },
    exclude: config.options.exclude,
    tsPreCompilationDeps: true,
    validate: true,
  });
  const output = result.output as ICruiseResult;
  const byFile = new Map<string, string[]>();
  for (const v of output.summary.violations) {
    if (v.rule.severity !== 'error') continue;
    byFile.set(v.from, [...(byFile.get(v.from) ?? []), v.rule.name].sort());
  }
  return byFile;
}

describe('layer rules (spec section 12.2)', () => {
  it('flag core importing a package, flag core importing another layer, and pass clean core code', async () => {
    const byFile = await violations();
    expect(byFile.get('src/core/usesPhaser.ts')).toEqual(['core-imports-only-core', 'core-no-packages']);
    expect(byFile.get('src/core/usesApp.ts')).toEqual(['core-imports-only-core']);
    expect(byFile.has('src/core/clean.ts')).toBe(false);
  });
});
