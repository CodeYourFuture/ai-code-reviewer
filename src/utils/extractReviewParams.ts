import { FeedbackPoint } from "../types/aiResponse.js";

export function extractReviewParams(point: FeedbackPoint) {
  const pointLines = getLineNumbers(point.line_numbers);
  return {
    body: point.questions,
    path: point.file_name,
    lines: pointLines,
  };
}

export function getLineNumbers(lineNumbers: string): number[][] {
  // TODO: make better handling
  if (!lineNumbers) return [];

  const lines: number[][] = [];
  const parts = lineNumbers.split(",");

  parts.forEach((part) => {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      lines.push([start, end]);
    } else {
      lines.push([Number(part)]);
    }
  });

  return lines;
}
