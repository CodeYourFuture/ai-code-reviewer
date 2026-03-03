import { expect, test } from "vitest";
import addLineNumbers from "./addLineNumbers";

const patch =
  "@@ -6,7 +6,7 @@ const personOne = {\n \n // Update the parameter to this function to make it work.\n // Don't change anything else.\n-function introduceYourself(___________________________) {\n+function introduceYourself({ name, age, favouriteFood }) {\n   console.log(\n     `Hello, my name is ${name}. I am ${age} years old and my favourite food is ${favouriteFood}.`\n   );";

test("lines annotated correctly", () => {
  expect(addLineNumbers(patch)).toBe(`@@ -6,7 +6,7 @@ const personOne = {
6|  
7|  // Update the parameter to this function to make it work.
8|  // Don't change anything else.
     -function introduceYourself(___________________________) {
9| +function introduceYourself({ name, age, favouriteFood }) {
10|    console.log(
11|      \`Hello, my name is \${name}. I am \${age} years old and my favourite food is \${favouriteFood}.\`
12|    );`);
});
