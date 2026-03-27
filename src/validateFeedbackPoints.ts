import { AiResponse } from "./types/aiResponse.js";
import type { PRFile } from "./types/githubTypes.js";

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
 * Parse a line_numbers string (e.g. "3,4,10-15") into an array of numbers.
 */
function parseLineNumbers(lineNumbersStr: string): number[] {
  const lines: number[] = [];
  const parts = lineNumbersStr.split(",").map((s) => s.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      for (let i = start; i <= end; i++) {
        lines.push(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        lines.push(num);
      }
    }
  }

  return lines;
}

/**
 * Validate feedback points against the actual PR files.
 * Filters out points that reference:
 * - Files not in the PR
 * - Line numbers outside the valid range in a file
 */
export function validateFeedbackPoints(
  responses: AiResponse[],
  files: PRFile[],
): AiResponse[] {
  // Build a map of filename -> max line number
  const fileLineMap = new Map<string, number>();
  for (const file of files) {
    const maxLine = getMaxLineInPatch(file.patch);
    fileLineMap.set(file.filename, maxLine);
  }

  return responses.map((response) => ({
    ...response,
    feedback_points: response.feedback_points.filter((point) => {
      // Check if file exists in PR
      if (!fileLineMap.has(point.file_name)) {
        console.log(
          `Filtering out feedback point: file "${point.file_name}" not in PR`,
        );
        return false;
      }

      // Check if all line numbers are valid
      const maxLine = fileLineMap.get(point.file_name)!;
      const lines = parseLineNumbers(point.line_numbers);

      for (const lineNum of lines) {
        if (lineNum > maxLine || lineNum < 1) {
          console.log(
            `Filtering out feedback point: line ${lineNum} out of range [1-${maxLine}] for file "${point.file_name}"`,
          );
          return false;
        }
      }

      return true;
    }),
  }));
}
