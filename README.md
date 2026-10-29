# How to Run

## Local development and testing

### Installation

Install dependencies:

```bash
npm install
cd client
npm install
cd ..
```

### Get a webhook proxy URL

In order to develop your app locally, you can use a webhook proxy URL to forward webhooks from GitHub to your computer or codespace. This app uses Smee.io to provide a webhook proxy URL and forward webhooks.

1. In your browser, navigate to https://smee.io/.
2. Click Start a new channel.
3. Copy the full URL under "Webhook Proxy URL". You will put it in .env in a later step.

### Create a GitHub App

Use a separate development GitHub App under your existing personal account. This gives you control over its webhook URL and credentials without changing the production app.

1. Open GitHub **Settings > Developer settings > GitHub Apps > New GitHub App**, or go directly to [New GitHub App](https://github.com/settings/apps/new).
2. Enter a unique app name, for example `yourname-ai-reviewer-dev`.
3. Set **Homepage URL** to this project's public repository URL or your GitHub profile URL. This is informational; it does not select the repositories the bot reviews.
4. Set **Callback URL** to `http://localhost:3000/api/auth/callback` for your development app. Leave **Setup URL** blank and **Request user authorization (OAuth) during installation** and **Enable Device Flow** unchecked. The same GitHub App handles bot installation authentication and direct user login; see the feedback login setup below.
5. Configure webhooks:
   - Keep **Active** checked and SSL verification enabled.
   - Set **Webhook URL** to the full Smee channel URL from the previous step. Use that same URL for `WEBHOOK_PROXY_URL` in `.env`.
   - Generate a webhook secret locally:

     ```sh
     node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
     ```

   - Copy the generated value into both GitHub's **Webhook secret** field and `WEBHOOK_SECRET` in `.env`. This secret verifies incoming deliveries; it is separate from the app's private key.
6. Under **Repository permissions**, configure:

   | Permission | Access | Purpose |
   | --- | --- | --- |
   | Pull requests | Read and write | Fetch PR diffs and post reviews |
   | Issues | Read and write | Manage PR labels and post conversation comments |
   | Metadata | Read-only (automatically included) | Repository metadata |

   Leave other permissions at **No access** for personal development. Organization membership checks are a separate production requirement.
7. Under **Subscribe to events**, select **Pull request**. The code handles its `labeled` action.
8. Under **Where can this GitHub App be installed?**, select **Only on this account**, then click **Create GitHub App**.
9. Copy the **App ID** into `APP_ID` in `.env`; do not use the Client ID.
10. Generate a private key in the app settings. Depending on the settings layout, use **Credentials â†’ Key pairs â†’ New key**, or **Private keys â†’ Generate a private key**. Store the downloaded `.pem` file outside the repository and set its path in `.env`, for example:

    ```env
    GITHUB_PRIVATE_KEY_PATH="C:/Users/yourname/secrets/ai-reviewer-dev.pem"
    ```

    Octokit uses this key to authenticate the app and obtain installation access tokens. For local development, use the file path and leave `GITHUB_PRIVATE_KEY` unset; the inline key takes precedence if both are provided. Keep `.env` and private keys out of version control.
11. In the app settings, choose **Install App**, install it on your personal account, and choose **Only select repositories**. Select a repository you own for testing, such as a personal fork or a small repository containing sample code. This installation selection determines which repositories the app can access.
12. In that repository, create labels named **Needs Review** and **Reviewed**, then open a PR with a small code change.

### Configure development or production access

Set these values in the root `.env` (see `.env.example.dev` and `.env.example.prod`):

```env
NODE_ENV="development"
DEV_GITHUB_USER_ALLOWLIST="your-github-username,another-tester"
GITHUB_MEMBERSHIP_ORG="CodeYourFuture"
```

In development, only usernames in the comma-separated allowlist may trigger reviews or rate feedback. Matching is case-insensitive and surrounding whitespace is ignored. An empty list denies everyone. Ratings still require GitHub login; the backend checks the GitHub username in its signed application session. The organization installation is not queried for development access, so a personal GitHub App works.

In production, set `NODE_ENV="production"`, leave `DEV_GITHUB_USER_ALLOWLIST` empty, and set `GITHUB_MEMBERSHIP_ORG` to the organization whose members may use the app. Install the app on that organization with organization **Members: read-only** permission, in addition to the repository permissions above. Production initializes the organization client at startup; if the installation lookup fails, the backend fails to start. Development skips that initialization and uses the allowlist. Production review events check membership using the event's installation client, which must have access to the configured organization's membership.

An omitted `NODE_ENV` defaults to `production`; unsupported values fail startup validation. `test` uses the development allowlist policy. A nonempty development allowlist is rejected in production. Whether a PR can receive repeated AI reviews is configured independently with `MULTIPLE_REVIEWS_ALLOWED`.

After starting the backend and Smee client as described below, manually add **Needs Review** to the test PR to trigger a review. Opening a PR or pushing commits alone does not trigger one. Bot-generated label events are ignored. Reviews send PR diffs to OpenRouter and consume API credits.

See GitHub's documentation for [registering an app](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) and [managing its private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps).

### Configure GitHub login for feedback ratings

The reviewer GitHub App also authenticates people submitting feedback. The backend redirects to GitHub, exchanges the authorization code using PKCE, fetches the authenticated GitHub user, and checks the development allowlist or production organization membership. It issues a signed application session in an HttpOnly cookie. GitHub user/refresh tokens are not persisted or sent to frontend JavaScript.

1. Open the same GitHub App used by the reviewer (use your personal development App locally).
2. Register the appropriate **Callback URL**:

   | Environment | Callback URL |
   | --- | --- |
   | Local development | `http://localhost:3000/api/auth/callback` |
   | Production | `https://YOUR_BACKEND_URL/api/auth/callback` |

3. Copy the App's **Client ID** and generate a **Client secret**. These are separate from the numeric `APP_ID`, private key, and webhook secret. No separate OAuth App is needed. GitHub Apps use registered permissions, so the login does not request OAuth scopes. No email permission is needed.
4. Generate a session signing secret locally:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Set these backend variables in the root `.env`:

   ```env
   GITHUB_APP_CLIENT_ID="<client-id-from-the-reviewer-GitHub-App>"
   GITHUB_APP_CLIENT_SECRET="<client-secret-from-that-App>"
   GITHUB_OAUTH_CALLBACK_URL="http://localhost:3000/api/auth/callback"
   SESSION_SECRET_KEY="<random-secret-at-least-32-characters>"
   SESSION_EXPIRE_HOURS=24
   FRONTEND_BASE_URL="http://localhost:5173"
   ```

6. Set the frontend's `client/.env`:

   ```env
   VITE_API_BASE_URL="http://localhost:3000"
   ```

Only the API URL belongs in frontend configuration. Restart local servers after changing variables. Use `localhost` consistently for both services; do not mix it with `127.0.0.1`.

Production keeps two independently deployed services, the backend and the feedback frontend.

Set `GITHUB_OAUTH_CALLBACK_URL` to the production callback above, `FRONTEND_BASE_URL` to the feedback frontend origin, and frontend `VITE_API_BASE_URL` to the backend origin. The URLs must use HTTPS in production. These hostnames are different origins but the same site. The backend allows credentialed CORS only for the configured frontend origin; frontend requests use `credentials: "include"`. Session cookies are host-only (no `Domain`), `HttpOnly`, `SameSite=Lax`, and `Secure` with the `__Host-` prefix in production. Both session and login cookies use `Path=/`.

The login transaction expires after five minutes. The callback validates browser-bound state and PKCE, then returns to the configured frontend with the original feedback `?id=...`; redirects cannot target arbitrary external URLs. Login errors retain the comment ID when a valid transaction is available. Open the original feedback link again if the transaction cookie has expired.

Sessions have a **fixed 24-hour expiry** by default, configurable from 1 to 168 hours through `SESSION_EXPIRE_HOURS`; activity does not renew them. Every protected ratings request rechecks authorization using the existing ten-minute membership cache. Organization removal can take up to that cache lifetime to take effect. Development uses only the username allowlist. Missing/expired sessions return 401, denied users 403, and membership lookup failures 502. Login errors appear on the feedback page.

`GET /api/auth/me` returns the user's numeric GitHub ID and login plus a session-bound CSRF token. Browser mutations (`POST /reaction/:id` and `POST /api/auth/logout`) require that token in `X-CSRF-Token` and the exact configured frontend `Origin`. Webhooks continue using their own signature verification without browser authentication or CSRF requirements.

Logout clears this browser's cookies and leaves the feedback ID in the URL; it does not log the user out of GitHub. A copied session token remains valid until expiry because sessions are stateless. Rotating `SESSION_SECRET_KEY` invalidates all sessions. GitHub authorization revocation does not immediately revoke these local sessions; expiry and the request-time access policy still apply.

Follow a bot feedback link and sign in to test. The numeric GitHub ID continues to identify ratings, preserving existing feedback and duplicate-rating checks. See [GitHub's user authorization documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).

### Get AI API key

For access to LLMs I used [Open Router](https://openrouter.ai/).
To get started:

- Create an Open Router account.
- Buy credits (minimum payment is 5$)
- Get your API key
- Add your key to the `OPENROUTER_API_KEY` env var

The reviewer behavior can be configured with these optional variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_MODEL` | `openai/gpt-6-luna` | OpenRouter model identifier |
| `AI_REASONING_EFFORT` | `medium` | Model reasoning effort (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`) |
| `AI_MAX_COMPLETION_TOKENS` | `25000` | Maximum generated tokens, including reasoning tokens |
| `MULTIPLE_REVIEWS_ALLOWED` | `false` | Whether the bot may review the same PR more than once |

`MULTIPLE_REVIEWS_ALLOWED` defaults to `false`, retaining the one-review-per-PR behavior. Set it to `true` to permit repeated reviews. When it is false, the reviewer checks the PR timeline for earlier activity by the reviewer bot before starting another review.

### Environment Setup

Create a `.env` file in the project root with these values:

```env
APP_ID=<your-github-app-id>
WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_PRIVATE_KEY_PATH=<path-to-your-private-key-file>
WEBHOOK_PROXY_URL="https://smee.io/<your-channel>"
OPENROUTER_API_KEY="YOUR_KEY"
AI_MODEL="openai/gpt-6-luna"
AI_REASONING_EFFORT="medium"
AI_MAX_COMPLETION_TOKENS=25000
MULTIPLE_REVIEWS_ALLOWED=true
DATABASE_USER="ai_reviewer_dev"
DATABASE_PASSWORD="<replace-with-generated-password>"
DATABASE_NAME="ai_reviewer_dev"
DATABASE_URL="postgres://ai_reviewer_dev:<same-generated-password>@localhost:5432/ai_reviewer_dev"
GITHUB_APP_CLIENT_ID="your-app-client-id"
GITHUB_APP_CLIENT_SECRET="your-app-client-secret"
GITHUB_OAUTH_CALLBACK_URL="http://localhost:3000/api/auth/callback"
SESSION_SECRET_KEY="your-generated-random-secret-at-least-32-characters"
SESSION_EXPIRE_HOURS=24
FRONTEND_BASE_URL="http://localhost:5173"
```

For the frontend, copy `client/.env.example` to `client/.env` and set the public `VITE_API_BASE_URL`. Keep all secrets in the backend environment.

### Configure PostgreSQL for local development

The Compose file starts PostgreSQL 18 only; run the backend and migrations on your host. Before starting the database, fill in all four database settings in the repository root `.env` (not `client/.env`). The blank values in `.env.example.dev` must be replaced.

1. Choose a local database username and database name, for example `ai_reviewer_dev` for both. Generate a password:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. Put the generated password in **both** `DATABASE_PASSWORD` and the password portion of `DATABASE_URL`, replacing the placeholders in the Environment Setup example above. Use the same username and database name in all settings.

   | Root `.env` setting | Used by | Purpose |
   | --- | --- | --- |
   | `DATABASE_USER` | Compose as `POSTGRES_USER` | Creates the initial database superuser (local development only) |
   | `DATABASE_PASSWORD` | Compose as `POSTGRES_PASSWORD` | Sets that user's initial password; must be nonempty |
   | `DATABASE_NAME` | Compose as `POSTGRES_DB` | Creates the initial application database |
   | `DATABASE_URL` | Backend and migration CLI | Connects to the existing database using those credentials |

   `DATABASE_URL` does not create a database or supply the container's initialization password. The backend reads only this connection string; it does not assemble it from the other three variables. Write the complete URL explicitly: the backend's dotenv loading does not expand `${DATABASE_PASSWORD}` references. Hexadecimal passwords avoid URL escaping issues; if you choose a password containing reserved URL characters, percent-encode it in the URL while keeping the original password in `DATABASE_PASSWORD`.

3. Ensure Docker is running and run the commands below from the repository root. Compose reads `.env` automatically; you do not need to export or source it. Existing shell environment variables override values from the file. If using WSL, create/edit `.env` in the same checkout where you run Compose.

### Running the Application

**Start the database after configuring the credentials above:**

```bash
docker compose --env-file .env up -d db
docker compose ps db
docker compose logs --tail=50 db
```

Wait for `database system is ready to accept connections` before migrating. Detached mode (`-d`) starts the container in the background; it does not guarantee successful initialization.

If you saw `superuser password is not specified`, fill in `DATABASE_PASSWORD` and the matching URL in `.env`, then rerun the `up` command. For troubleshooting, `docker compose --env-file .env config` shows the resolved container settings, including the password, so do not share its output unredacted. Do not use `POSTGRES_HOST_AUTH_METHOD=trust` as a workaround.

Initialization settings apply only when the database data directory is empty. Editing `.env` does not change credentials or rename a database that has already been initialized; use SQL administration to change the existing database and update `DATABASE_URL` accordingly. Do not delete volumes to resolve a credential mismatch if you need to retain data.

The Compose file maps host port 5432 to PostgreSQL. If that port is occupied, change the host side of the mapping (for example `5433:5432`) and use that port in `DATABASE_URL`. The current mapping publishes on all host interfaces; for local-only access, change it to `127.0.0.1:5432:5432`.

To stop and resume the existing database, use `docker compose stop db` and `docker compose start db`. The supplied Compose file has no explicit named data volume; do not rely on container removal/recreation preserving access to its data. Configure a persistent volume before storing anything you need to keep. See the [official PostgreSQL image documentation](https://hub.docker.com/_/postgres) and [Compose environment-file documentation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

**Run migrations from the repository root using the same `DATABASE_URL`:**

```bash
npm run migrate up
```

Migrations create the application tables in the database initialized by PostgreSQL. The backend checks its database connection before listening and exits if it cannot connect.

Run pending migrations before starting updated application code. Prompt deduplication uses a unique index on `md5(prompt)` so long prompts can be stored without exceeding PostgreSQL's B-tree key-size limit. The full text is retained, and the application checks text equality before reusing an ID. Rolling back the hash-index migration can fail once long prompts have been stored, because it restores the original full-text unique constraint; a failed rollback leaves the data intact.

**Start the backend in watch mode:**

```bash
npm run dev
```

The backend should be available on `http://localhost:3000` by default.

**To receive GitHub webhooks locally, in a second terminal, run:**

```bash
npm run webhook
```

This uses your `.env` values and forwards webhooks to `http://localhost:3000/api/webhook`.

The `webhook` script uses Bash syntax. If you get errors in Windows or WSL, you can run the Smee client directly replacing the example URL with your Smee channel:

```
npx smee -u "https://smee.io/<your-channel>" -t http://localhost:3000/api/webhook
```

Keep both the backend and Smee client running. Setting `WEBHOOK_PROXY_URL` alone does not start forwarding or update the GitHub App's settings. If you change the backend port, update the Smee target too. To troubleshoot delivery, check the app settings' **Advanced > Recent deliveries** and the backend terminal; you can redeliver an event after fixing the configuration.

**To start the frontend application:**
In another terminal run:

```bash
cd client
npm run dev
```

The frontend is served by Vite at `http://localhost:5173` by default.

### Other scripts

Run unit tests with Vitest:

```bash
npm test
```

Run type checking:

```bash
npm run typeCheck
```

## Coolify Deployment Instructions

In production, you do not need a webhook proxy.

For production GitHub App setup, use `GITHUB_PRIVATE_KEY` with the raw `.pem` content instead of `GITHUB_PRIVATE_KEY_PATH`.

1. Add New Resource, select Public Repository, and point to this GitHub repository. Add all variables from `.env.example.prod`
   Use these commands to build and start the backend:

```bash
npm run build
npm run migrate up && npm run start
```

2. To deploy the frontend
   1. Create another recourse
   2. Check both:
   - `Is it a static site?`
   - `Is it a SPA (Single Page Application)?`
   3. set `Base directory` to `/client`
   4. set `Publish Directory` to `/dist`
   5. add env vars
