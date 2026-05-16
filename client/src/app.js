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
const profileContainer = document.getElementById("profile");
const closeBtn = document.getElementById("close-btn");
const submissionMsg = document.querySelector(".logged-in-message");
let auth0Client;
let commentId = identifyFeedbackCommentId();

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

  if (isAuthenticated) {
    try {
      const token = await auth0Client.getTokenSilently();
      return token;
    } catch (error) {
      console.error("Error getting token:", error);
      showError(error.message);
    }
  }
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
  try {
    const isAuthenticated = await auth0Client.isAuthenticated();

    if (isAuthenticated) {
      showLoggedIn();
      const user = await getUserData();
      const res = await hasUserRatedComment(user.sub.split("|")[1]);
      if (res === true) {
        showMessage("you already submitted feedback for that comment");
      }
    } else {
      showLoggedOut();
    }

    hideLoading();
  } catch (err) {
    showError(err.message);
  }
}

async function getUserData() {
  try {
    const user = await auth0Client.getUser();
    console.log(user);
    return user;
  } catch (err) {
    console.error("Error getting profile:", err);
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
      if (reaction == "like" || reaction == "dislike") {
        const user = await getUserData();
        const response = await fetch(
          `http://localhost:3000/reaction/${commentId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reaction,
              userId: user.sub.split("|")[1],
              nickname: user.nickname,
            }),
          },
        );
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
async function hasUserRatedComment(userId) {
  try {
    const token = await getAccessToken();
    if (token) {
      const response = await fetch(
        `http://localhost:3000/hasUserRatedComment/${commentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        showError(data.message);
        return;
      } else {
        if (data.message == true || data.message == false) return data.message;
      }
    } else {
      throw new Error("no token");
    }
  } catch (err) {
    showError(err.message);
  }
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

function hideError(message) {
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
