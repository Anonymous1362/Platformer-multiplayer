import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'android/**',
      'ios/**',
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The deterministic simulation layer must run in Node with no platform or wall-clock access.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Random in core/Random.ts.' },
        { object: 'Math', property: 'sin', message: 'Use DMath tables in simulation code.' },
        { object: 'Math', property: 'cos', message: 'Use DMath tables in simulation code.' },
        { object: 'Math', property: 'pow', message: 'Not allowed in simulation code.' },
        { object: 'Date', property: 'now', message: 'The simulation never reads wall-clock time.' },
        { object: 'performance', property: 'now', message: 'The simulation never reads wall-clock time.' },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'requestAnimationFrame',
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
