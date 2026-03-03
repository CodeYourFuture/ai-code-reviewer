export default function addLineNumbers(patch: string) {
  let newLine = 0;

  const annotated = patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("@@")) {
        const match = line.match(/\+(\d+),?/);
        if (match) {
          newLine = parseInt(match[1], 10);
        }
        return line;
      }

      if (line.startsWith("+")) {
        const out = `${newLine}| ${line}`;
        newLine++;
        return out;
      }

      if (line.startsWith("-")) {
        return `     ${line}`;
      }

      const out = `${newLine}| ${line}`;
      newLine++;
      return out;
    })
    .join("\n");

  return annotated;
}
