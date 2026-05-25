# How to Run

## Dev and testing

### Installation

Install dependencies:

```bash
npm install
```

### Create GitHub app

https://docs.github.com/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-github-app-that-responds-to-webhook-events#register-a-github-app

### Get a webhook proxy URL

In order to develop your app locally, you can use a webhook proxy URL to forward webhooks from GitHub to your computer or codespace. This app uses Smee.io to provide a webhook proxy URL and forward webhooks.

1. In your browser, navigate to https://smee.io/.
2. Click Start a new channel.
3. Copy the full URL under "Webhook Proxy URL". You will put it in .env in a later step.

### Create Auth0

This app uses Auth0 for authentication with GitHub as the login provider. The frontend uses the Auth0 SPA SDK, and the backend validates JWTs using express-oauth2-jwt-bearer.

1. Create an Auth0 Account & Tenant
   1. Go to auth0.com and sign up
   2. Create a new tenant (e.g., my-app.us.auth0.com) — this becomes your `AUTH0_DOMAIN`

2. Create a Single Page Application (Frontend)
   1. In the Auth0 dashboard, go to Applications → Applications → Create Application
   2. Choose Single Page Application

   3. Configure the SPA settings:
      Navigate to the Settings tab and fill in:
   - Allowed Callback URLs: http://localhost:5173
   - Logout URLs: http://localhost:5173
   - Web Origins:http://localhost:5173
   4. Save changes. Note the Client ID — this is your `VITE_AUTH0_CLIENT_ID`.
   5. Set Up GitHub Social Connection
      1. Go to Authentication → Social → Create Connection
      2. Select GitHub and deselect everything else
      3. You'll need a GitHub OAuth App:
         1. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
         2. Set Homepage URL
         3. Set Authorization callback URL: https://<your-tenant>.auth0.com/login/callback
         4. Copy the `Client ID` and `Client Secret` into Auth0's GitHub connection settings
      4. Make sure GitHub connection is enabled for your SPA

3. Create an API (Backend)
   1. Go to Applications → APIs → Create API
   - You can use any URL as an identifier, it doesn't matter. It will be your `AUTH0_AUDIENCE` in the backend and `VITE_AUTH0_AUDIENCE` in the frontend

### Environment Setup

Create a `.env` file in the project root with the following variables:

```
APP_ID=<your-github-app-id>
WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_PRIVATE_KEY_PATH=<path-to-your-private-key-file>
WEBHOOK_PROXY_URL="YOUR_WEBHOOK_PROXY_URL"
OPENROUTER_API_KEY="YOUR_KEY"
DATABASE_URL="LINK_TO_YOUR_DB"
AUTH0_DOMAIN="your-tenant-domain"
AUTH0_AUDIENCE="your-audience"
BASE_URL="Frontend url"

```

### Running the Application

Start the db:

```bash
docker compose up -d
```

Run migrations:

```bash
npm run migrate up
```

Start the server with:

```bash
npm run dev
```

- The server will start on `http://localhost:3000` (or your configured PORT).\
- Server is listening for events at: `http://localhost:3000/api/webhook` (or your configured webhook url)

### Running the Webhook delivery

1. Open second terminal window
2. To receive forwarded webhooks from Smee.io, run

```bash
npm run webhook
```

That command assumes your webhook url is `http://localhost:3000/api/webhook`

## Production

In production you don't need `weebhook proxy` and instead of GITHUB_PRIVATE_KEY_PATH use GITHUB_PRIVATE_KEY with content of .pem file downloaded from github.  
In production the start commands are  
`npm run build`  
`npm run start`
