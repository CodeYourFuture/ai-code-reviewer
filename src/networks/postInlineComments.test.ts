import { expect, test } from "vitest";
import { formReviewParams } from "./postInlineComment";

test("create start line and line when two numbers", () => {
  expect(formReviewParams([46, 49])).toEqual({ start_line: 46, line: 49 });
});
test("return line when one number passed", () => {
  expect(formReviewParams([46])).toEqual({ line: 46 });
});

test.todo("Function sends post request with the right params");
test.todo("Function throws error when passing incorrect params");
test.todo("throws error if github return error");
