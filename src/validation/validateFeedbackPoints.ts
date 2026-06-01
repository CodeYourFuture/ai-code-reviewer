import { ReviewWithPrompt } from "../types/aiResponse.js";
import type { PRFile } from "../types/githubTypes.js";
import { getLineNumbers } from "../utils/extractReviewParams.js";

/**
 * Extract the maximum line number from a patch by parsing the '@@' hunk headers.
 * Returns 0 if no patch or invalid format.
 */
function getMaxLineInPatch(patch: string | undefined): number {
  if (!patch) return 0;

  let maxLine = 0;
  const lines = patch.split("\n");

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/\+(\d+)/);
      if (match) {
        const newStart = parseInt(match[1], 10);
        // Count how many new lines are added after this point
        let addedLines = 0;
        const idx = lines.indexOf(line);
        for (let i = idx + 1; i < lines.length; i++) {
          const nextLine = lines[i];
          if (nextLine.startsWith("@@")) {
            break; // Next hunk
          }
          if (!nextLine.startsWith("-")) {
            // Lines that start with + or space (context) are counted as new lines
            addedLines++;
          }
        }
        maxLine = Math.max(maxLine, newStart + addedLines - 1);
      }
    }
  }
  return maxLine;
}

/**
 * Validate feedback points against the actual PR files.
 * Filters out points that reference:
 * - Files not in the PR
 * - Line numbers outside the valid range in a file
 */
export function validateFeedbackPoints(
  responses: ReviewWithPrompt[],
  files: PRFile[],
): ReviewWithPrompt[] {
  const fileLineMap = new Map<string, number>();
  for (const file of files) {
    const maxLine = getMaxLineInPatch(file.patch);
    fileLineMap.set(file.filename, maxLine);
  }

  return responses.map((response) => ({
    ...response,
    review: {
      ...response.review,
      feedback_points: response.review.feedback_points.filter((point) => {
        if (!fileLineMap.has(point.file_name)) {
          console.log(
            `Filtering out feedback point: file "${point.file_name}" not in PR`,
          );
          return false;
        }

        const maxLine = fileLineMap.get(point.file_name)!;
        const lines = getLineNumbers(point.line_numbers);

        for (const lineNum of lines[0]) {
          if (lineNum > maxLine || lineNum < 1) {
            console.log(
              `Filtering out feedback point: line ${lineNum} out of range [1-${maxLine}] for file "${point.file_name}"`,
            );
            return false;
          }
        }

        return true;
      }),
    },
  }));
}
