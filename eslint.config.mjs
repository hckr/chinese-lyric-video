import { makeConfig } from "@remotion/eslint-config-flat";

export default [
  ...makeConfig({ remotionDir: "src/**/*.{ts,tsx}" }),
  {
    files: ["web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true },
      ],
    },
  },
];
