import { describe, expect, it } from "vitest";
import type { PRFileWithContent } from "../types/githubTypes.js";
import { prepareCodeForReview } from "./prepareCodeForReview.js";

describe("prepareCodeForReview", () => {
  it("includes the diff as the feedback target and full source as context", () => {
    const files = [
      {
        filename: "src/example.ts",
        status: "modified",
        patch: "@@ -1 +1 @@\n-oldName()\n+newName()",
        fullContent: "export function newName() {\n  return true;\n}\n",
      } as PRFileWithContent,
    ];

    const prompt = prepareCodeForReview({ files });

    expect(prompt).toContain("Changed lines (the only valid feedback targets):");
    expect(prompt).toContain("1| +newName()");
    expect(prompt).toContain(
      "Full file at PR head (supporting context only; not a feedback target):",
    );
    expect(prompt).toContain("export function newName()");
  });

  it("does not add a full-file section when content is unavailable", () => {
    const files = [
      {
        filename: "image.png",
        status: "modified",
      } as PRFileWithContent,
    ];

    expect(prepareCodeForReview({ files })).not.toContain(
      "<full-file-context",
    );
  });

  it("explains why full-file context was omitted", () => {
    const files = [
      {
        filename: "deleted.ts",
        status: "removed",
        fullContentOmittedReason:
          "Full-file context is not included for deleted files.",
      } as PRFileWithContent,
    ];

    expect(prepareCodeForReview({ files })).toContain(
      "Full-file context is not included for deleted files.",
    );
  });
});
