import type { PRFile } from "../types/githubTypes.js";
import addLineNumbers from "./addLineNumbers.js";

export function prepareCodeForReview(params: { files: PRFile[] }) {
  const { files } = params;

  const filesText = files
    .map((f) => {
      const patch =
        typeof f.patch === "string"
          ? addLineNumbers(clearDefaultComments(f.patch))
          : "NO_PATCH_AVAILABLE";

      return `### File: ${f.filename} (${f.status})
\`\`\`diff
${patch}
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
function clearDefaultComments(patch: string): string {
  const patchWithRemovedComments = patch
    .split("\n")
    .map((line) => {
      if (line.startsWith(" //")) {
        line = "  ";
        return line;
      } else {
        return line;
      }
    })
    .join("\n");
  return patchWithRemovedComments;
}
