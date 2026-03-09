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

### Environment Setup
Create a `.env` file in the project root with the following variables:
```
APP_ID=<your-github-app-id>
WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_PRIVATE_KEY_PATH=<path-to-your-private-key-file>
WEBHOOK_PROXY_URL="YOUR_WEBHOOK_PROXY_URL"
OPENROUTER_API_KEY="YOUR_KEY"
```

### Running the Application
Start the server with:
```bash
npm run server
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
```npm run build```  
```npm run start```
