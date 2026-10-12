import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // core/ is pure: it may only import from core/.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@/(?!core/)',
              message: 'core/ may only import from core/.',
            },
            {
              regex: '(^|/)(input|render|ui|export|storage|app)(/|$)|(^|/)(config|main)$',
              message: 'core/ may only import from core/.',
            },
            { regex: '^@mediapipe/', message: 'core/ must not depend on MediaPipe.' },
          ],
        },
      ],
    },
  },
  prettier,
);
