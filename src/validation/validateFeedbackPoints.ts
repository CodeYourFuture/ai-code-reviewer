import { ReviewWithPrompt } from "../types/aiResponse.js";
import type { PRFile } from "../types/githubTypes.js";

/** Return the right-side line numbers that were actually added by the patch. */
function getAddedLineNumbers(patch: string | undefined): Set<number> {
  const addedLines = new Set<number>();
  if (!patch) return addedLines;

  let currentLine: number | undefined;
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      currentLine = match ? Number(match[1]) : undefined;
      continue;
    }

    if (currentLine === undefined) continue;
    if (line.startsWith("+")) {
      addedLines.add(currentLine);
      currentLine++;
    } else if (line.startsWith(" ")) {
      currentLine++;
    }
    // Deleted lines and "No newline at end of file" markers do not advance
    // the right-side line number.
  }

  return addedLines;
}

function expandTargetLines(lineNumbers: string[]): number[] | undefined {
  if (lineNumbers.length !== 1) return undefined;

  const match = lineNumbers[0].match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return undefined;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (start < 1 || end < start) return undefined;

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/**
 * Filter out findings that cannot be posted to lines added by this PR.
 */
export function validateFeedbackPoints(
  responses: ReviewWithPrompt[],
  files: PRFile[],
): ReviewWithPrompt[] {
  const addedLinesByFile = new Map(
    files.map((file) => [file.filename, getAddedLineNumbers(file.patch)]),
  );

  return responses.map((response) => ({
    ...response,
    feedback_points: response.feedback_points.filter((point) => {
      const addedLines = addedLinesByFile.get(point.file_name);
      if (!addedLines) {
        console.log(
          `Filtering out feedback point: file "${point.file_name}" not in PR`,
        );
        return false;
      }

      const targetLines = expandTargetLines(point.line_numbers);
      if (!targetLines?.length) {
        console.log(
          `Filtering out feedback point: invalid line numbers for file "${point.file_name}"`,
        );
        return false;
      }

      const invalidLine = targetLines.find((line) => !addedLines.has(line));
      if (invalidLine !== undefined) {
        console.log(
          `Filtering out feedback point: line ${invalidLine} was not added in file "${point.file_name}"`,
        );
        return false;
      }

      return true;
    }),
  }));
}
