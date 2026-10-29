import type { PRFileWithContent } from "../types/githubTypes.js";
import addLineNumbers from "./addLineNumbers.js";

export function preparePatchForReview(patch: string | undefined) {
  return typeof patch === "string"
    ? addLineNumbers(clearDefaultComments(patch))
    : "NO_PATCH_AVAILABLE";
}

export function prepareCodeForReview(params: { files: PRFileWithContent[] }) {
  const { files } = params;

  const filesText = files
    .map((f) => {
      const patch = preparePatchForReview(f.patch);

      const fullFileContext =
        typeof f.fullContent === "string"
          ? `
Full file at PR head (supporting context only; not a feedback target):
<full-file-context filename="${f.filename}">
${f.fullContent}
</full-file-context>
`
          : f.fullContentOmittedReason
            ? `
Full-file context status: ${f.fullContentOmittedReason}
`
            : "";

      return `### File: ${f.filename} (${f.status})
Changed lines (the only valid feedback targets):
\`\`\`diff
${patch}
\`\`\`
${fullFileContext}
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
