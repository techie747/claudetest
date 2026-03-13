/**
 * Human Design API Routes
 * RESTful endpoints for the Frequency Intelligence Engine HD calculation pipeline.
 */

const express = require('express');
const router = express.Router();
const { calculateHumanDesignChart, calculateChartFromUTC, longitudeToGateLine, CERTAINTY_LEVELS } = require('../human-design');

/**
 * POST /api/human-design/chart
 * Calculate a complete Human Design chart from birth data.
 *
 * Body:
 * {
 *   "birth_date": "1992-08-14",
 *   "birth_time": "07:32",
 *   "birth_city": "Chicago",
 *   "birth_country": "USA",
 *   "time_certainty": "exact",       // optional: exact, approx_15, approx_60, unknown
 *   "timezone_id": "America/Chicago", // optional: auto-resolved if omitted
 *   "lat": 41.8781,                   // optional: auto-resolved if omitted
 *   "lon": -87.6298                   // optional: auto-resolved if omitted
 * }
 *
 * Options (query params):
 *   ?sensitivity=true   — include birth time sensitivity analysis
 *   ?substructure=true  — include color/tone/base in activations
 *   ?audit=true         — include step-by-step audit trail
 */
router.post('/chart', async (req, res) => {
  try {
    const options = {
      include_sensitivity: req.query.sensitivity === 'true',
      include_substructure: req.query.substructure === 'true',
      include_audit: req.query.audit === 'true'
    };

    const result = await calculateHumanDesignChart(req.body, options);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Human Design chart calculation error:', error);
    res.status(500).json({
      success: false,
      errors: ['Internal calculation error: ' + error.message]
    });
  }
});

/**
 * POST /api/human-design/chart-utc
 * Calculate a chart from a pre-resolved UTC datetime.
 * Skips geocoding and timezone resolution.
 *
 * Body:
 * {
 *   "birth_utc": "1992-08-14T11:32:00Z"
 * }
 */
router.post('/chart-utc', (req, res) => {
  try {
    const { birth_utc } = req.body;

    if (!birth_utc) {
      return res.status(400).json({
        success: false,
        errors: ['birth_utc is required (ISO 8601 UTC datetime)']
      });
    }

    const options = {
      include_substructure: req.query.substructure === 'true'
    };

    const result = calculateChartFromUTC(birth_utc, options);
    res.json(result);
  } catch (error) {
    console.error('UTC chart calculation error:', error);
    res.status(500).json({
      success: false,
      errors: ['Calculation error: ' + error.message]
    });
  }
});

/**
 * POST /api/human-design/gate-lookup
 * Look up the gate and line for a specific ecliptic longitude.
 * Useful for testing and validation.
 *
 * Body:
 * {
 *   "longitude": 123.4567
 * }
 */
router.post('/gate-lookup', (req, res) => {
  try {
    const { longitude } = req.body;

    if (longitude === undefined || longitude === null) {
      return res.status(400).json({
        success: false,
        errors: ['longitude is required (0-360 degrees)']
      });
    }

    const result = longitudeToGateLine(parseFloat(longitude));
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      success: false,
      errors: ['Lookup error: ' + error.message]
    });
  }
});

/**
 * GET /api/human-design/certainty-levels
 * Returns available time certainty levels for the UI.
 */
router.get('/certainty-levels', (req, res) => {
  res.json({
    success: true,
    levels: [
      { value: CERTAINTY_LEVELS.EXACT, label: 'Exact to minute', description: 'Birth time is known precisely' },
      { value: CERTAINTY_LEVELS.APPROXIMATE_15, label: 'Within 15 minutes', description: 'Birth time is approximate within 15 minutes' },
      { value: CERTAINTY_LEVELS.APPROXIMATE_60, label: 'Within 1 hour', description: 'Birth time is approximate within 1 hour' },
      { value: CERTAINTY_LEVELS.UNKNOWN, label: 'Unknown', description: 'Birth time is not known' }
    ]
  });
});

/**
 * GET /api/human-design/reference/channels
 * Returns the channel definition table.
 */
router.get('/reference/channels', (req, res) => {
  const { CHANNELS } = require('../human-design/data');
  res.json({ success: true, channels: CHANNELS });
});

/**
 * GET /api/human-design/reference/centers
 * Returns the center definition table.
 */
router.get('/reference/centers', (req, res) => {
  const { CENTERS } = require('../human-design/data');
  res.json({ success: true, centers: CENTERS });
});

/**
 * GET /api/human-design/reference/gates
 * Returns the gate boundary table.
 */
router.get('/reference/gates', (req, res) => {
  const { GATE_BOUNDARIES } = require('../human-design/data');
  res.json({ success: true, gates: GATE_BOUNDARIES });
});

module.exports = router;
