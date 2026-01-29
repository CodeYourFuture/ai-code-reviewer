## How to Run

### Installation
Install dependencies:
```bash
npm install
```

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
PRIVATE_KEY_PATH=<path-to-your-private-key-file>
WEBHOOK_PROXY_URL="YOUR_WEBHOOK_PROXY_URL"
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

