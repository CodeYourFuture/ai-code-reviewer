import { describe, expect, test } from "vitest";
import type { AiResponse } from "./types/aiResponse.js";
import type { PRFile } from "./types/githubTypes.js";
import { validateFeedbackPoints } from "./validateFeedbackPoints.js";

const makePoint = (file_name: string, line_numbers: string, severity = 5) => ({
  file_name,
  line_numbers,
  topics: ["naming"],
  summary: "A summary",
  point: "A point",
  severity,
});

const makeResponse = (points: ReturnType<typeof makePoint>[]): AiResponse => ({
  feedback_type: "code quality",
  feedback_points: points,
});

// Patch with 5 new lines starting at line 1:
// @@ -0,0 +1,5 @@
// +line1
// +line2
// +line3
// +line4
// +line5
const patchFiveLines =
  "@@ -0,0 +1,5 @@\n+line1\n+line2\n+line3\n+line4\n+line5";

const makeFile = (filename: string, patch?: string): PRFile => ({
  sha: "333",
  filename,
  patch,
  status: "modified",
  additions: 0,
  deletions: 0,
  changes: 0,
  blob_url: "",
  raw_url: "",
  contents_url: "",
});

describe("validateFeedbackPoints", () => {
  test("passes through valid points with correct file and line", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "3")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("filters out point referencing a file not in the PR", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("bar.ts", "1")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("filters out point with line number exceeding max line", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "6")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("filters out point with line number less than 1", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "0")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("does NOT filter a point with '-1' — parseLineNumbers misidentifies it as a range, producing no lines to check", () => {
    // "-1".split("-") → ["", "1"], start = NaN, loop never runs → 0 lines validated → point passes
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "-1")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("accepts point with line number exactly at max line", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "5")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("accepts point with line number exactly at 1", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "1")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("filters out point when any line in a range exceeds max", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "4-6")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("accepts point with valid line range entirely within bounds", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "2-4")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("accepts point with comma-separated lines all within bounds", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "1,3,5")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("filters out point when any line in comma list is out of bounds", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "1,3,6")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("accepts point with mixed range and individual lines all valid", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([makePoint("foo.ts", "1,3-5")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
  });

  test("filters out all points when file has no patch (maxLine = 0)", () => {
    const files = [makeFile("foo.ts", undefined)];
    const responses = [makeResponse([makePoint("foo.ts", "1")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("filters out all points when file has empty patch string", () => {
    const files = [makeFile("foo.ts", "")];
    const responses = [makeResponse([makePoint("foo.ts", "1")])];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("keeps valid points and filters invalid ones in the same response", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [
      makeResponse([
        makePoint("foo.ts", "2"),
        makePoint("foo.ts", "99"),
        makePoint("bar.ts", "1"),
        makePoint("foo.ts", "5"),
      ]),
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(2);
    expect(result[0].feedback_points[0].line_numbers).toBe("2");
    expect(result[0].feedback_points[1].line_numbers).toBe("5");
  });

  test("processes multiple responses independently", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [
      makeResponse([makePoint("foo.ts", "2")]),
      makeResponse([makePoint("foo.ts", "99")]),
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
    expect(result[1].feedback_points).toHaveLength(0);
  });

  test("returns empty array when given empty responses", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const result = validateFeedbackPoints([], files);
    expect(result).toHaveLength(0);
  });

  test("returns response with empty feedback_points unchanged", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses = [makeResponse([])];
    const result = validateFeedbackPoints(responses, files);
    expect(result).toHaveLength(1);
    expect(result[0].feedback_points).toHaveLength(0);
  });

  test("handles multiple files and routes validation to correct file", () => {
    const fileFive = makeFile("five.ts", patchFiveLines);
    // Single-line patch: maxLine = 1
    const fileOne = makeFile("one.ts", "@@ -0,0 +1 @@\n+only line");
    const files = [fileFive, fileOne];
    const responses = [
      makeResponse([
        makePoint("five.ts", "5"),
        makePoint("one.ts", "1"),
        makePoint("one.ts", "2"), // out of range for one.ts
      ]),
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(2);
  });

  test("removes only lines starting with - from line count (deleted lines not counted)", () => {
    // Patch: starts at new line 10, has 1 deleted and 2 added/context lines
    // @@ -10,1 +10,2 @@
    // -old line (deleted, not counted)
    // +new line (counted → line 10)
    //  context  (counted → line 11)
    const patchWithDeletion =
      "@@ -10,1 +10,2 @@\n-old line\n+new line\n context";
    const files = [makeFile("foo.ts", patchWithDeletion)];
    const responses = [
      makeResponse([
        makePoint("foo.ts", "10"),
        makePoint("foo.ts", "11"),
        makePoint("foo.ts", "12"), // out of range
      ]),
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(2);
  });

  test("handles multi-hunk patches and uses the highest max line", () => {
    const multiHunkPatch =
      "@@ -1,2 +1,2 @@\n+hunk1line1\n+hunk1line2\n@@ -20,3 +20,3 @@\n+hunk2line1\n+hunk2line2\n+hunk2line3";
    const files = [makeFile("foo.ts", multiHunkPatch)];
    const responses = [
      makeResponse([
        makePoint("foo.ts", "22"),
        makePoint("foo.ts", "23"), // out of range (maxLine = 22)
      ]),
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_points).toHaveLength(1);
    expect(result[0].feedback_points[0].line_numbers).toBe("22");
  });

  test("preserves all other response fields unchanged", () => {
    const files = [makeFile("foo.ts", patchFiveLines)];
    const responses: AiResponse[] = [
      {
        feedback_type: "comments quality",
        feedback_points: [makePoint("foo.ts", "1")],
      },
    ];
    const result = validateFeedbackPoints(responses, files);
    expect(result[0].feedback_type).toBe("comments quality");
  });
});
