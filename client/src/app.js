const loading = document.getElementById("loading");
const error = document.getElementById("error");
const errorDetails = document.getElementById("error-details");
const app = document.getElementById("app");
const loggedOutSection = document.getElementById("logged-out");
const loggedInSection = document.getElementById("logged-in");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const likeBtn = document.getElementById("like-btn");
const dislikeBtn = document.getElementById("dislike-btn");
const closeBtn = document.getElementById("close-btn");
const submissionMsg = document.querySelector(".logged-in-message");
const API_BASE = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
const params = new URLSearchParams(window.location.search);
const commentId = params.get("id");
let csrfToken;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.method === "POST"
        ? { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }
        : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    csrfToken = undefined;
    showLoggedOut();
    const err = new Error(
      "Your session has expired. Please sign in with GitHub.",
    );
    err.status = 401;
    throw err;
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(data?.message || `Request failed: ${response.status}`);
  return data;
}

async function initAuth() {
  hideError();
  if (
    !commentId ||
    !/^[1-9]\d*$/.test(commentId) ||
    !Number.isSafeInteger(Number(commentId))
  ) {
    showError(
      "No valid comment ID found. Please reopen the feedback link from GitHub.",
    );
    return;
  }
  try {
    const session = await api("/api/auth/me");
    csrfToken = session.csrfToken;
    const rated = await api(`/hasUserRatedComment/${commentId}`);
    if (typeof rated.message !== "boolean")
      throw new Error("Unexpected feedback response");
    if (rated.message)
      showMessage("You have already submitted feedback for this comment");
    else showLoggedIn();
  } catch (err) {
    if (err.status !== 401) showError(err.message);
  }
  const loginError = params.get("error");
  if (loginError) {
    showError(loginError);
    params.delete("error");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params}`,
    );
  }
}

function login() {
  const url = new URL(`${API_BASE}/api/auth/login`);
  url.searchParams.set("id", commentId);
  window.location.assign(url.href);
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    csrfToken = undefined;
    hideError();
    showLoggedOut();
  } catch (err) {
    showError(err.message);
  }
}

async function sendReaction(reaction) {
  likeBtn.disabled = dislikeBtn.disabled = true;
  try {
    await api(`/reaction/${commentId}`, {
      method: "POST",
      body: JSON.stringify({ reaction }),
    });
    showMessage("Feedback submitted successfully");
  } catch (err) {
    showError(err.message);
  } finally {
    likeBtn.disabled = dislikeBtn.disabled = false;
  }
}

function showError(message) {
  loading.style.display = "none";
  error.style.display = "block";
  errorDetails.textContent = message;
}

function hideError() {
  loading.style.display = "none";
  app.style.display = "flex";
  error.style.display = "none";
}

function showLoggedIn() {
  loggedOutSection.style.display = "none";
  loggedInSection.style.display = "flex";
  submissionMsg.style.display = "none";
  likeBtn.style.display = dislikeBtn.style.display = "block";
}

function showLoggedOut() {
  loggedInSection.style.display = "none";
  loggedOutSection.style.display = "flex";
}

function showMessage(message) {
  showLoggedIn();
  submissionMsg.style.display = "flex";
  likeBtn.style.display = dislikeBtn.style.display = "none";
  submissionMsg.textContent = message;
}

// Event listeners
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
likeBtn.addEventListener("click", () => sendReaction("like"));
dislikeBtn.addEventListener("click", () => sendReaction("dislike"));
closeBtn.addEventListener("click", hideError);
// Initialize the app
initAuth();
