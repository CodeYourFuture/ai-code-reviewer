import type { PRFile } from "../types/githubTypes.js";
import addLineNumbers from "./addLineNumbers.js";

export function buildPRReviewPrompt(params: { files: PRFile[] }) {
  const { files } = params;

  const filesText = files
    .map((f) => {
      if (typeof f.patch === "string") {
        f.patch = addLineNumbers(f.patch);
      }

      return `### File: ${f.filename} (${f.status})
\`\`\`diff
${f.patch ?? "NO_PATCH_AVAILABLE"}
\`\`\`
`;
    })
    .join("\n");

  return `
Review this GitHub Pull Request.

Changed files:
${filesText}
`;
}
