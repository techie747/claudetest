# Blog Topic Webhook App

A simple web application that allows you to submit blog topic ideas and sends them to a configurable webhook endpoint.

## Features

- Clean, modern web interface
- Simple form asking "What blog topic would you like to create today?"
- Sends submitted topics to a webhook URL
- Works with any webhook endpoint (Slack, Discord, custom APIs, etc.)
- Graceful handling when webhook is not configured

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure your webhook URL:

```bash
cp .env.example .env
```

4. Edit the `.env` file and add your webhook URL:

```env
WEBHOOK_URL=https://your-webhook-url-here
```

## Usage

1. Start the server:

```bash
npm start
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

3. Enter a blog topic and submit!

## Configuration

### Environment Variables

- `PORT` - The port to run the server on (default: 3000)
- `WEBHOOK_URL` - The webhook endpoint to send blog topics to

### Webhook Payload

When a topic is submitted, the following JSON payload is sent to your webhook:

```json
{
  "topic": "Your blog topic here",
  "timestamp": "2026-01-06T23:06:00.000Z",
  "source": "blog-topic-app"
}
```

## Examples

### Slack Webhook

```env
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Discord Webhook

For Discord, you may need to adjust the payload format. Modify `server.js` to send:

```javascript
const payload = {
  content: `New blog topic: ${topic}`
};
```

### Custom API

```env
WEBHOOK_URL=https://api.yourdomain.com/blog-topics
```

## Development

The app consists of:

- `server.js` - Express backend server with webhook integration
- `public/index.html` - Frontend interface
- `.env` - Configuration file (create from .env.example)

## Notes

- If no webhook URL is configured, the app will still accept topics but only log them to the console
- All submitted topics are logged to the server console
- The app includes error handling for webhook failures

## License

MIT
