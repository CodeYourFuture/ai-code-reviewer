import {
  FeedbackPointWithTopic,
  ReviewWithPrompt,
} from "../types/aiResponse.js";

export function removeAdditionalLineNumbersAndSymbols(
  review: ReviewWithPrompt,
): FeedbackPointWithTopic[] {
  const sanitisedLineNumbers = review.feedback_points.flatMap((point) => {
    if (!point.line_numbers?.length) return [];

    const match = point.line_numbers[0].match(/\d+(?:-\d+)?/);
    if (!match) return [];
    return [
      {
        ...point,
        line_numbers: [match[0], ...point.line_numbers.slice(1)],
      },
    ];
  });

  return sanitisedLineNumbers;
}
