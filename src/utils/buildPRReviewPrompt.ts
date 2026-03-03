import type { PRFile } from "../types/githubTypes";
import addLineNumbers from "./addLineNumbers";

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

// Instructions:
// - Identify bugs, edge cases, security issues, and performance issues.
// - Suggest improvements and best practices.
// - If a patch is missing, mention what additional context is needed.
// - Provide a final summary + checklist.
