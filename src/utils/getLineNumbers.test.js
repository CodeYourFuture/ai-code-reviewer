import { expect, test } from "vitest";
import { getLineNumbers } from "./extractReviewParams";

const point = {
  file_name: "Sprint-1/destructuring/exercise-3/exercise.js",
  summary:
    "Redundant parameter in findMaxItemNameLength, and code style improvements.",
  description:
    "The function `findMaxItemNameLength` is declared with two parameters but only uses one, which can cause confusion and is unnecessary. Also, variable names should follow consistent camelCase (ItemNameLengthList should be itemNameLengthList). Using `map` to extract lengths and then `Math.max` is a good approach but can be briefly commented for clarity. Additionally, in `penceToPounds`, the conversion handles stretching and padding manually; consider using built-in formatting methods for clarity and reliability.",
  questions:
    "Why should we avoid unused parameters in function definitions? What naming conventions are common in JavaScript and why? How might built-in number formatting methods help simplify the pence to pounds conversion?",
  line_numbers: "46-49,32-44, 47",
  severity: 3,
};

test("line numbers extracted correctly", () => {
  expect(getLineNumbers(point.line_numbers)).toStrictEqual([
    [46, 49],
    [32, 44],
    [47],
  ]);
});
