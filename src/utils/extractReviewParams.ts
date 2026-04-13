import { FeedbackPoint } from "../types/aiResponse.js";

export function extractReviewParams(point: FeedbackPoint) {
  const pointLines = getLineNumbers(point.line_numbers);
  return {
    body: point.point,
    path: point.file_name,
    lines: pointLines,
  };
}

export function getLineNumbers(lineNumbers: string[]): number[][] {
  // TODO: make better handling
  if (!lineNumbers) return [];

  const lines: number[][] = [];

  if (lineNumbers[0].includes("-")) {
    const [start, end] = lineNumbers[0].split("-").map(Number);
    lines.push([start, end]);
  } else {
    lines.push([Number(lineNumbers[0])]);
  }

  return lines;
}
