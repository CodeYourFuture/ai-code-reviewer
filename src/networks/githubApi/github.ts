import { Octokit } from "octokit";
import { TextDecoder } from "node:util";
import type {
  PRFile,
  PRFileWithContent,
} from "../../types/githubTypes.js";

const CONTENT_FETCH_CONCURRENCY = 5;
export const MAX_FULL_FILE_CONTEXT_BYTES = 256 * 1024;
export const MAX_TOTAL_FULL_FILE_CONTEXT_BYTES = 1024 * 1024;

const DELETED_FILE_CONTEXT_REASON =
  "Full-file context is not included for deleted files because they do not exist at the PR head.";
const NON_TEXT_FILE_CONTEXT_REASON =
  "Full-file context is not included because this is a binary or non-UTF-8 file.";
const UNAVAILABLE_FILE_CONTEXT_REASON =
  "Full-file context could not be retrieved from GitHub.";

type TextContentResult =
  | { status: "text"; content: string }
  | { status: "too-large" }
  | { status: "non-text" };

function decodeTextContent(content: unknown): TextContentResult {
  let bytes: Buffer;
  if (typeof content === "string") {
    bytes = Buffer.from(content, "utf8");
  } else if (content instanceof ArrayBuffer) {
    bytes = Buffer.from(content);
  } else if (ArrayBuffer.isView(content)) {
    bytes = Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  } else {
    return { status: "non-text" };
  }

  // Check the raw byte length before scanning or decoding the file. The response
  // has already been downloaded, but this avoids additional large allocations.
  if (bytes.byteLength > MAX_FULL_FILE_CONTEXT_BYTES) {
    return { status: "too-large" };
  }

  // NUL bytes are a strong binary-file signal and are unusual in source text.
  if (bytes.includes(0)) return { status: "non-text" };

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { status: "non-text" };
  }

  // Text files can contain tabs and line breaks, but other ASCII control
  // characters commonly indicate that the decoded content is binary data.
  const maximumAllowedControlCharacters = Math.max(1, text.length * 0.01);
  let disallowedControlCharacters = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isDisallowed =
      // Allow tab (9), line feed (10), and carriage return (13).
      (codePoint < 32 && character !== "\n" && character !== "\r" && character !== "\t") ||
      // DEL and C1 controls are also uncommon in source and other text files.
      (codePoint >= 127 && codePoint <= 159);

    if (isDisallowed) {
      disallowedControlCharacters++;
      if (disallowedControlCharacters > maximumAllowedControlCharacters) {
        return { status: "non-text" };
      }
    }
  }

  // Permit an occasional control character, but classify the content as binary
  // when more than 1% of its characters are controls. Math.max avoids treating
  // one unusual character in a short file as enough evidence that it is binary.
  return { status: "text", content: text };
}

async function addFullTextContent(
  file: PRFile,
  owner: string,
  repo: string,
  commitId: string,
  octokit: Octokit,
): Promise<PRFileWithContent> {
  if (file.status === "removed") {
    return { ...file, fullContentOmittedReason: DELETED_FILE_CONTEXT_REASON };
  }

  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path: file.filename,
        ref: commitId,
        headers: { accept: "application/vnd.github.raw+json" },
      },
    );
    const textContent = decodeTextContent(response.data);
    if (textContent.status === "non-text") {
      return {
        ...file,
        fullContentOmittedReason: NON_TEXT_FILE_CONTEXT_REASON,
      };
    }
    if (textContent.status === "too-large") {
      const reason = `Full-file context is not included because it exceeds the ${MAX_FULL_FILE_CONTEXT_BYTES}-byte per-file limit.`;
      console.warn(`Omitting full-file context for ${file.filename}: ${reason}`);
      return {
        ...file,
        fullContentOmittedReason: reason,
      };
    }
    return { ...file, fullContent: textContent.content };
  } catch (error) {
    console.warn(`Could not fetch full content for ${file.filename}`, error);
    return {
      ...file,
      fullContentOmittedReason: UNAVAILABLE_FILE_CONTEXT_REASON,
    };
  }
}

async function addFullTextContents(
  files: PRFile[],
  owner: string,
  repo: string,
  commitId: string,
  octokit: Octokit,
): Promise<PRFileWithContent[]> {
  const enrichedFiles: PRFileWithContent[] = new Array(files.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      enrichedFiles[index] = await addFullTextContent(
        files[index],
        owner,
        repo,
        commitId,
        octokit,
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONTENT_FETCH_CONCURRENCY, files.length) },
      () => worker(),
    ),
  );

  let includedBytes = 0;
  return enrichedFiles.map((file) => {
    if (typeof file.fullContent !== "string") return file;

    const contentBytes = Buffer.byteLength(file.fullContent, "utf8");
    if (includedBytes + contentBytes > MAX_TOTAL_FULL_FILE_CONTEXT_BYTES) {
      const { fullContent: _fullContent, ...fileWithoutContent } = file;
      const reason = `Full-file context is not included because the review reached its ${MAX_TOTAL_FULL_FILE_CONTEXT_BYTES}-byte total context limit.`;
      console.warn(`Omitting full-file context for ${file.filename}: ${reason}`);
      return {
        ...fileWithoutContent,
        fullContentOmittedReason: reason,
      };
    }

    includedBytes += contentBytes;
    return file;
  });
}

/**
 * Function to get code from the PR
 */
export async function getPRFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  commitId?: string,
): Promise<PRFileWithContent[]> {
  const res = await octokit.request(
    `GET /repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    { per_page: 100 },
  );

  let headCommitId = commitId;
  if (!headCommitId) {
    const pullRequest = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: pullNumber },
    );
    headCommitId = pullRequest.data.head.sha;
  }

  return addFullTextContents(res.data, owner, repo, headCommitId, octokit);
}
