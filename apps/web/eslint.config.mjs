/** @type {import("eslint").Linter.Config} */
const eslintConfig = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    // Disable some strict rules for faster development
    "@typescript-eslint/no-unused-vars": "warn",
  },
};

export default eslintConfig;
