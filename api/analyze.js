export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'No Anthropic API key configured — add one in the Admin tab, or set ANTHROPIC_API_KEY on the server.' });
    return;
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Analysis engine request failed', details: error.message });
  }
}
