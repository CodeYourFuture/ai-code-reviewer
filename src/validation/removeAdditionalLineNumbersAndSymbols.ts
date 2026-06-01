import { AiResponse } from "../types/aiResponse.js";

export function removeAdditionalLineNumbersAndSymbols(
  review: AiResponse,
): AiResponse {
  const sanitisedLineNumbers = review.feedback_points.flatMap((point) => {
    const match = point.line_numbers[0].match(/\d+(?:-\d+)?/);
    if (!match) return [];
    return [
      {
        ...point,
        line_numbers: [match[0], ...point.line_numbers.slice(1)],
      },
    ];
  });

  return { ...review, feedback_points: sanitisedLineNumbers };
}
