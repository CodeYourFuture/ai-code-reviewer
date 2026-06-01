import { createAuth0Client } from "@auth0/auth0-spa-js";

// DOM elements
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
let auth0Client;
let commentId = identifyFeedbackCommentId();

const API_BASE = import.meta.env.VITE_API_BASE_URL;
// Initialize Auth0 client
async function initAuth0() {
  try {
    auth0Client = await createAuth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: "https://localhost:5173/",
      },
    });

    // Check if user is returning from login
    if (
      window.location.search.includes("code=") &&
      window.location.search.includes("state=")
    ) {
      await handleRedirectCallback();
    }
    // Update UI based on authentication state
    await updateUI();
  } catch (err) {
    showError(err.message);
  }
}

async function getAccessToken() {
  const isAuthenticated = await auth0Client.isAuthenticated();
  if (!isAuthenticated) throw new Error("User is not authenticated");
  return await auth0Client.getTokenSilently();
}

function identifyFeedbackCommentId() {
  return new URLSearchParams(document.location.search).get("id");
}
// Handle redirect callback
async function handleRedirectCallback() {
  try {
    const { appState } = await auth0Client.handleRedirectCallback();

    commentId = appState?.commentId;

    // Clean up the URL to remove query parameters
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (err) {
    showError(err.message);
  }
}

// Update UI based on authentication state
async function updateUI() {
  if (!commentId) {
    showError("No comment ID found in URL");
    hideLoading();
    return;
  }
  try {
    const isAuthenticated = await auth0Client.isAuthenticated();

    if (isAuthenticated) {
      const res = await hasUserRatedComment();
      if (res === true) {
        throw new Error("User has already submitted feedback for that comment");
      }
      showLoggedIn();
    } else {
      showLoggedOut();
    }

    hideLoading();
  } catch (err) {
    hideLoading();
    showMessage(err.message);
  }
}
// Event handlers
async function login() {
  try {
    await auth0Client.loginWithRedirect({
      connection: "github",
      //i need to pass comment id in order to keep it in state after login process
      appState: { commentId: commentId },
    });
  } catch (err) {
    showError(err.message);
  }
}

async function logout() {
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  } catch (err) {
    showError(err.message);
  }
}

async function sendReaction(reaction) {
  try {
    const token = await getAccessToken();
    if (token) {
      if (reaction === "like" || reaction === "dislike") {
        const response = await fetch(`${API_BASE}/reaction/${commentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reaction,
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          showError(data.message);
          return;
        }
        showMessage("Feedback submitted successfully");
      }
    } else {
      throw new Error("no token");
    }
  } catch (err) {
    showError(err.message);
  }
}
async function hasUserRatedComment() {
  const token = await getAccessToken();

  if (!token) throw new Error("No token available");

  const response = await fetch(`${API_BASE}/hasUserRatedComment/${commentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  if (typeof data.message !== "boolean") {
    throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
  }

  return data.message;
}

// UI state management
function showLoading() {
  loading.style.display = "block";
  error.style.display = "none";
  app.style.display = "none";
}

function hideLoading() {
  loading.style.display = "none";
  app.style.display = "flex";
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
}

function showLoggedOut() {
  loggedInSection.style.display = "none";
  loggedOutSection.style.display = "flex";
}
function showMessage(message) {
  loggedOutSection.style.display = "none";
  loggedInSection.style.display = "flex";
  submissionMsg.style.display = "flex";
  likeBtn.style.display = "none";
  dislikeBtn.style.display = "none";
  submissionMsg.textContent = message;
}

// Event listeners
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
likeBtn.addEventListener("click", () => sendReaction("like"));
dislikeBtn.addEventListener("click", () => sendReaction("dislike"));
closeBtn.addEventListener("click", hideError);

// Initialize the app
initAuth0();
