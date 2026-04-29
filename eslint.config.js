import tseslint from 'typescript-eslint';
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      // The project allows @ts-nocheck on complex UI/DOM files (fabric-canvas,
      // map-section, tools) and on test files that mock untyped fixtures —
      // see PROJECT.md / .github/copilot-instructions.md.
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-nocheck': false,
        'ts-ignore': true,
        'ts-expect-error': 'allow-with-description',
      }],
      // Allow intentionally-unused parameters and variables prefixed with `_`
      // (standard TypeScript convention, used in abstract base method signatures
      // and `catch (_)` blocks throughout the codebase).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
);
