require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/tuner', express.static('guitar-tuner'));

app.post('/api/submit-topic', async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Blog topic is required' });
  }

  const webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('No webhook URL configured. Topic received:', topic);
    return res.json({
      success: true,
      message: 'Topic received (webhook not configured)',
      topic: topic
    });
  }

  try {
    const payload = {
      topic: topic,
      timestamp: new Date().toISOString(),
      source: 'blog-topic-app'
    };

    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Successfully sent topic to webhook:', topic);
    res.json({
      success: true,
      message: 'Topic submitted successfully!',
      topic: topic
    });
  } catch (error) {
    console.error('Error sending to webhook:', error.message);
    res.status(500).json({
      error: 'Failed to send topic to webhook',
      details: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Blog Topic Webhook App running on http://localhost:${PORT}`);
  console.log(`Webhook URL: ${process.env.WEBHOOK_URL || 'Not configured'}`);
});
