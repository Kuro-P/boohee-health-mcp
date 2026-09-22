import eslintPlugin from "@typescript-eslint/eslint-plugin"
import parser from "@typescript-eslint/parser"

export default [
  {
    files: [ "src/**/*.ts" ],
    languageOptions: {
      parser,
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    plugins: {
      "@typescript-eslint": eslintPlugin
    },
    rules: {
      "array-bracket-spacing": [ "error", "always" ],
      "block-spacing": [ "error", "always" ],
      "comma-dangle": [ "error", "never" ],
      "eol-last": [ "error", "always" ],
      "object-curly-spacing": [ "error", "always" ],
      "semi": [ "error", "never" ]
    }
  }
]
