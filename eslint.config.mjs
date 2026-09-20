import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // The config files sit outside tsconfig's include, so they are typed
        // against the default project rather than excluded from linting.
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused arguments are common and meaningful in Express middleware —
      // an error handler must declare all four to be recognised as one.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Mongoose and zod inference produce shapes that are genuinely awkward
      // to name; these are warnings so they surface without blocking CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    // Tests and one-shot scripts print on purpose.
    files: ['src/test/**', 'src/openapi/generate.ts'],
    rules: { 'no-console': 'off' },
  },
)
