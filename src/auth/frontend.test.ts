import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../client/src/app.js", import.meta.url),
  "utf8",
).replace(
  "import.meta.env.VITE_API_BASE_URL",
  JSON.stringify("https://backend.example"),
);

async function render(responses: Response[], search = "?id=42") {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id))
      elements.set(id, {
        style: {},
        textContent: "",
        addEventListener: vi.fn(function (
          this: any,
          event: string,
          handler: () => Promise<void>,
        ) {
          this[event] = handler;
        }),
      });
    return elements.get(id);
  };
  const fetcher = vi.fn();
  for (const response of responses) fetcher.mockResolvedValueOnce(response);
  const location = { search, pathname: "/", assign: vi.fn() };
  const history = { replaceState: vi.fn() };
  runInNewContext(source, {
    document: { getElementById: element, querySelector: element },
    window: { location, history },
    URL,
    URLSearchParams,
    fetch: fetcher,
  });
  // Let the asynchronous initialization's fetch/JSON operations complete.
  await new Promise((resolve) => setImmediate(resolve));
  return { element, fetcher, location, history };
}

describe("feedback browser flow", () => {
  it("navigates directly to backend GitHub login with the feedback ID", async () => {
    const view = await render([new Response(null, { status: 401 })]);
    expect(view.element("logged-out").style.display).toBe("flex");
    await view.element("login-btn").click();
    expect(view.location.assign).toHaveBeenCalledWith(
      "https://backend.example/api/auth/login?id=42",
    );
    expect(view.fetcher.mock.calls[0][1].credentials).toBe("include");
  });

  it("sends session-bound CSRF protection when rating and logging out and preserves the URL", async () => {
    const view = await render([
      Response.json({
        user: { id: 12345, login: "alice" },
        csrfToken: "session-csrf",
      }),
      Response.json({ message: false }),
      Response.json({ message: "sent" }),
      new Response(null, { status: 204 }),
    ]);
    await view.element("like-btn").click();
    expect(view.fetcher.mock.calls[2]).toEqual([
      "https://backend.example/reaction/42",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: '{"reaction":"like"}',
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "session-csrf",
        },
      }),
    ]);
    expect(view.element(".logged-in-message").textContent).toBe(
      "Feedback submitted successfully",
    );
    await view.element("logout-btn").click();
    expect(view.element("logged-out").style.display).toBe("flex");
    expect(view.location.search).toBe("?id=42");
    expect(view.location.assign).not.toHaveBeenCalled();
    expect(view.history.replaceState).not.toHaveBeenCalled();
  });

  it("offers sign-in again when the session expires during submission", async () => {
    const view = await render([
      Response.json({ csrfToken: "session-csrf" }),
      Response.json({ message: false }),
      new Response(null, { status: 401 }),
    ]);
    await view.element("like-btn").click();
    expect(view.element("logged-out").style.display).toBe("flex");
    expect(view.element("error-details").textContent).toContain(
      "session has expired",
    );
    expect(view.element("like-btn").disabled).toBe(false);
  });

  it("displays previous feedback and sanitizes login errors without losing the feedback ID", async () => {
    const view = await render(
      [Response.json({ csrfToken: "csrf" }), Response.json({ message: true })],
      "?id=42&error=Access%20denied",
    );
    expect(view.element(".logged-in-message").textContent).toContain(
      "already submitted",
    );
    expect(view.element("like-btn").style.display).toBe("none");
    expect(view.element("error-details").textContent).toBe("Access denied");
    expect(view.history.replaceState).toHaveBeenCalledWith({}, "", "/?id=42");
  });
});
