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
4. Leave **Callback URL** and **Setup URL** blank. Leave **Request user authorization (OAuth) during installation** and **Enable Device Flow** unchecked. The bot authenticates as an app installation; user login for ratings is handled separately by Auth0 below.
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

In development, only usernames in the comma-separated allowlist may trigger reviews or rate feedback. Matching is case-insensitive and surrounding whitespace is ignored. An empty list denies everyone. Ratings still require Auth0 login; the backend checks the GitHub nickname in the validated token. The organization installation is not queried for development access, so a personal GitHub App works.

In production, set `NODE_ENV="production"`, leave `DEV_GITHUB_USER_ALLOWLIST` empty, and set `GITHUB_MEMBERSHIP_ORG` to the organization whose members may use the app. Install the app on that organization with organization **Members: read-only** permission, in addition to the repository permissions above. Production initializes the organization client at startup; if the installation lookup fails, the backend fails to start. Development skips that initialization and uses the allowlist. Production review events check membership using the event's installation client, which must have access to the configured organization's membership.

An omitted `NODE_ENV` defaults to `production`; unsupported values fail startup validation. `test` uses the development allowlist policy. A nonempty development allowlist is rejected in production. Production also enables the previous-review check; development allows repeated reviews.

After starting the backend and Smee client as described below, manually add **Needs Review** to the test PR to trigger a review. Opening a PR or pushing commits alone does not trigger one. Bot-generated label events are ignored. Reviews send PR diffs to OpenRouter and consume API credits.

See GitHub's documentation for [registering an app](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) and [managing its private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps).

### Configure Auth0 for feedback ratings

Auth0 authenticates people who like or dislike the bot's feedback. The frontend signs users in through GitHub using the Auth0 SPA SDK; the backend validates Auth0 access tokens before checking the development allowlist or production organization membership. Auth0 is not involved in generating reviews or authenticating the bot to GitHub. The current backend configuration nevertheless requires Auth0 settings at startup.

There are three separate registrations in this setup:

| Registration | Where | Purpose |
| --- | --- | --- |
| Reviewer GitHub App | GitHub > Developer settings > GitHub Apps | Receives webhooks and posts reviews using its App ID and private key |
| Login GitHub OAuth App | GitHub > Developer settings > OAuth Apps | Lets Auth0 sign users in with GitHub |
| Auth0 Single Page Application (SPA) | Auth0 > Applications > Applications | Connects the frontend to Auth0 using its Client ID |

The existing reviewer GitHub App could support direct user login with code changes, but this project currently uses Auth0 and a separate GitHub OAuth App. Do not mix their IDs or secrets.

#### 1. Create an Auth0 tenant

1. **On Auth0:** Create an account and tenant at [auth0.com](https://auth0.com/).
2. Copy the tenant's exact domain, including any regional component, for example `my-dev-tenant.us.auth0.com`.
3. Set backend `AUTH0_DOMAIN` and frontend `VITE_AUTH0_DOMAIN` to that hostname, without `https://`, a trailing slash, or `/login/callback`.

#### 2. Create the Auth0 frontend application

1. **On Auth0:** Go to **Applications > Applications > Create Application** and choose **Single Page Application**.
2. Open its **Settings** tab and configure:

   | Setting | Local development value |
   | --- | --- |
   | Allowed Callback URLs | `http://localhost:5173` |
   | Allowed Logout URLs | `http://localhost:5173` |
   | Allowed Web Origins | `http://localhost:5173` |

3. Save changes and copy this Auth0 application's **Client ID** for `VITE_AUTH0_CLIENT_ID`. This is not the GitHub OAuth Client ID or reviewer App ID. No Auth0 client secret belongs in the frontend.

#### 3. Connect GitHub login to Auth0

1. **On Auth0:** Go to **Authentication > Social > Create Connection**, select **GitHub**, and open its settings. Keep this page open while you create the GitHub OAuth App in another tab. The connection needs that app's Client ID and Client Secret.
2. **On GitHub:** Go to **Settings > Developer settings > OAuth Apps > New OAuth App**.
3. **On GitHub:** Enter an application name, a homepage URL (for example your full Auth0 tenant URL, `https://my-dev-tenant.us.auth0.com`), and the **Authorization callback URL** (also called the redirect URI):

   ```text
   https://my-dev-tenant.us.auth0.com/login/callback
   ```

   Replace the example hostname with your exact Auth0 domain. Copy the callback URL displayed in Auth0's GitHub connection setup, especially if you use a custom domain. `https://.auth0.com/login/callback` is incomplete. This callback returns the user to Auth0, not directly to localhost.
4. **On GitHub:** Register the OAuth App, copy its **Client ID**, and generate a **Client Secret**.
5. **Back on Auth0:** Paste those GitHub credentials into the GitHub connection settings and save. These credentials stay in Auth0; they are not the `APP_ID`, private key, or `VITE_AUTH0_CLIENT_ID` used by this project.
6. **On Auth0:** Open the connection's **Applications** tab and enable it for the SPA created in step 2. Keep GitHub as the login provider for this application; the backend expects a GitHub identity.

The redirect journey is: frontend -> Auth0 -> GitHub -> Auth0 -> frontend.

| Configured in | URL | Purpose |
| --- | --- | --- |
| GitHub OAuth App: Authorization callback URL / redirect URI | `https://<your-auth0-domain>/login/callback` | GitHub returns the user to Auth0 |
| Auth0 SPA: Allowed Callback URLs | `http://localhost:5173` | Auth0 returns the user to the frontend |

See [Auth0's GitHub login guide](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/github).

#### 4. Register the backend API in Auth0

1. **On Auth0:** Go to **Applications > APIs > Create API**.
2. Give the API a name and a stable URL-shaped **Identifier**, for example `https://ai-reviewer-api`. The project's environment validation requires a URL. This is an identifier, not a callback address, and it does not need to host a website.
3. Use the API's **Identifier** exactly as both backend `AUTH0_AUDIENCE` and frontend `VITE_AUTH0_AUDIENCE`. Keep the signing algorithm as **RS256**.
4. **On Auth0:** Open the API's **Application Access** tab. Find the SPA created in step 2 by its name or Client ID (the value used for `VITE_AUTH0_CLIENT_ID`), and click **Grant Access** for **User-Delegated Access**. If the API's **Settings > Application Access Policy** requires per-app authorization, this grant is required before the SPA can request tokens for the API. This is user login access, not machine-to-machine/client access.
5. The application may show **0/0 permissions granted** because this API defines no custom scopes. You do not need to create permissions for the current ratings implementation; granting the SPA access is separate from selecting scopes. Save any changes and retry login from a feedback URL such as `http://localhost:5173/?id=1`, using an existing feedback-point ID.

If login returns `Client "..." is not authorized to access resource server "..."`, confirm that you granted access to the correct SPA on the API matching the requested audience. If it returns `Service not found`, confirm that an API with that exact Identifier exists in the tenant specified by `VITE_AUTH0_DOMAIN`. See [Auth0's API access-policy guide](https://auth0.com/blog/developers-guide-api-access-policies-auth0/).

The audience identifies the API for which the token was issued. The domain identifies the Auth0 tenant issuing it. Neither is the custom claim name below.

#### 5. Add the GitHub username to access tokens

1. **On Auth0:** Go to **Actions > Library** and create a custom Action for the **Login / Post Login** trigger.
2. Add the following JavaScript and deploy the Action:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim(
       "https://yourapp.com/nickname",
       event.user.nickname
     );
   };
   ```

3. **On Auth0:** Open **Actions > Triggers** (or **Flows**, depending on the dashboard layout), select **Login / Post Login**, and add the deployed Action between **Start** and **Complete**. Apply/save the flow. Deploying the Action alone does not attach it to login.

For the GitHub connection, this Action copies the user's nickname into a custom access-token claim. The backend expects that value to be the GitHub username and uses it for access checks and rating attribution. The resulting payload includes a field such as:

```json
{
  "https://yourapp.com/nickname": "your-github-username"
}
```

**Keep the claim name exactly as shown for the current code.** `src/server.ts` reads `https://yourapp.com/nickname` explicitly. This URL is a namespace for the claim name: it is not visited, need not resolve, and is unrelated to the callback URL or API audience.

Namespacing custom claims avoids collisions. For a new design, prefer a stable namespace based on a domain your organization controls and a precise field such as `https://<organization-domain>/ai-code-reviewer/github_username`. The current `yourapp.com` name is a placeholder retained for compatibility. Renaming it requires coordinated changes to the Auth0 Action and every backend lookup; changing the Action alone will break ratings. See [Auth0's custom claim guidance](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims).

#### 6. Set matching backend and frontend environment values

In the repository root `.env`:

```env
AUTH0_DOMAIN="my-dev-tenant.us.auth0.com"
AUTH0_AUDIENCE="https://ai-reviewer-api"
FRONTEND_BASE_URL="http://localhost:5173"
```

Copy `client/.env.example` to `client/.env` and configure:

```env
VITE_AUTH0_DOMAIN="my-dev-tenant.us.auth0.com"
VITE_AUTH0_CLIENT_ID="<client-id-from-the-Auth0-SPA>"
VITE_AUTH0_AUDIENCE="https://ai-reviewer-api"
VITE_API_BASE_URL="http://localhost:3000"
```

Use your own tenant, SPA Client ID, and API Identifier. Domain and audience must match between backend and frontend. `FRONTEND_BASE_URL` supplies links in the bot's comments; `VITE_API_BASE_URL` tells the frontend where to send ratings requests. Restart the development servers after changing environment values.

To test ratings, follow a feedback link from a bot comment (the frontend needs its `id` query parameter) and sign in with GitHub. In development, ensure your GitHub username is in `DEV_GITHUB_USER_ALLOWLIST`. Authentication via Auth0 does not by itself grant permission to submit ratings. After changing the Action, log out and sign in again to obtain a token with the new claim.

### Get AI API key

For access to LLMs I used [Open Router](https://openrouter.ai/).
To get started:

- Create an Open Router account.
- Buy credits (minimum payment is 5$)
- Get your API key
- Add your key to the `OPENROUTER_API_KEY` env var

### Environment Setup

Create a `.env` file in the project root with these values:

```env
APP_ID=<your-github-app-id>
WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_PRIVATE_KEY_PATH=<path-to-your-private-key-file>
WEBHOOK_PROXY_URL="https://smee.io/<your-channel>"
OPENROUTER_API_KEY="YOUR_KEY"
DATABASE_USER="ai_reviewer_dev"
DATABASE_PASSWORD="<replace-with-generated-password>"
DATABASE_NAME="ai_reviewer_dev"
DATABASE_URL="postgres://ai_reviewer_dev:<same-generated-password>@localhost:5432/ai_reviewer_dev"


AUTH0_DOMAIN="your-tenant-domain"
AUTH0_AUDIENCE="your-audience"
FRONTEND_BASE_URL="http://localhost:5173"
```

For the frontend, copy the example environment file in the `client` folder and add all credentials

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
