import { expect, test } from "vitest";
import { FeedbackPoint } from "../types/aiResponse.js";
import { getLineNumbers } from "./extractReviewParams.js";

const point: FeedbackPoint = {
  file_name: "Sprint-1/destructuring/exercise-3/exercise.js",
  topics: [],
  summary:
    "Redundant parameter in findMaxItemNameLength, and code style improvements.",
  point:
    "The function `findMaxItemNameLength` is declared with two parameters but only uses one, which can cause confusion and is unnecessary. Also, variable names should follow consistent camelCase (ItemNameLengthList should be itemNameLengthList). Using `map` to extract lengths and then `Math.max` is a good approach but can be briefly commented for clarity. Additionally, in `penceToPounds`, the conversion handles stretching and padding manually; consider using built-in formatting methods for clarity and reliability.",
  line_numbers: ["46-49"],
  severity: 3,
};

test("line numbers extracted correctly", () => {
  expect(getLineNumbers(point.line_numbers)).toStrictEqual([[46, 49]]);
});
