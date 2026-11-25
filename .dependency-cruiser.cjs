/** Layer rules from spec section 12.2. `tests/unit/layer-rules.test.ts` proves the core rules fire. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No import cycles anywhere.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-imports-only-core',
      severity: 'error',
      comment:
        'src/core runs in Node and imports only src/core: no Phaser, DOM libraries, Capacitor, PeerJS, or any package.',
      from: { path: '^src/core/' },
      to: { pathNot: '^src/core/' },
    },
    {
      name: 'core-no-packages',
      severity: 'error',
      comment: 'src/core may not import npm packages or Node built-ins.',
      from: { path: '^src/core/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'input-imports-core-input-types-only',
      severity: 'error',
      comment: 'src/input depends on core/InputTypes.ts and itself only.',
      from: { path: '^src/input/' },
      to: { pathNot: ['^src/input/', '^src/core/InputTypes\\.ts$'] },
    },
    {
      name: 'net-imports-core-and-net-only',
      severity: 'error',
      comment: 'src/net imports core types and codecs only.',
      from: { path: '^src/net/' },
      to: { path: '^src/(render|hud|audio|ui|cinematics|native|scenes|input)/' },
    },
    {
      name: 'no-orphans-in-src',
      severity: 'warn',
      from: { orphan: true, path: '^src/', pathNot: '\\.d\\.ts$' },
      to: {},
    },
  ],
  options: {
    // Do not descend into packages, but keep the edges to them so the rules above can see them.
    // (Excluding node_modules here once hid every package import from every rule.)
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '^dist/' },
  },
};
