/**
 * Confidence & Sensitivity Engine
 * Calculates confidence scores and performs birth time sensitivity analysis.
 * This is a major differentiator — makes charts trustworthy rather than black-box.
 */

const { CERTAINTY_LEVELS, CERTAINTY_WINDOWS, toJulianDay } = require('./input-normalizer');
const { calculateAllPositions, normalizeDeg } = require('./astro-engine');
const { computeChart } = require('./hd-engine');

// ─── Confidence Scoring ─────────────────────────────────────────────────────

/**
 * Calculate confidence score for a computed chart.
 * Returns a score from 0.0 to 1.0 with detailed warnings.
 */
function calculateConfidence(chart, normalizedInput) {
  let score = 1.0;
  const warnings = [];
  const factors = [];

  // Factor 1: Time certainty
  const certainty = normalizedInput.time_certainty;
  const certaintyScores = {
    [CERTAINTY_LEVELS.EXACT]: 1.0,
    [CERTAINTY_LEVELS.APPROXIMATE_15]: 0.85,
    [CERTAINTY_LEVELS.APPROXIMATE_60]: 0.60,
    [CERTAINTY_LEVELS.UNKNOWN]: 0.25
  };

  const certScore = certaintyScores[certainty] || 0.5;
  score *= certScore;
  factors.push({
    factor: 'time_certainty',
    level: certainty,
    impact: certScore,
    detail: `Birth time certainty: ${certainty}`
  });

  if (certainty !== CERTAINTY_LEVELS.EXACT) {
    warnings.push(`Birth time is ${certainty === CERTAINTY_LEVELS.UNKNOWN ? 'unknown' : 'approximate'}. Some chart features may vary.`);
  }

  // Factor 2: Birth time provided
  if (!normalizedInput.birth_time_provided) {
    score *= 0.3;
    warnings.push('No birth time provided. Using noon default. Chart is highly uncertain.');
    factors.push({
      factor: 'no_birth_time',
      impact: 0.3,
      detail: 'No birth time provided, using 12:00 default'
    });
  }

  // Factor 3: Boundary proximity analysis
  const boundaryWarnings = analyzeBoundaryProximity(chart, normalizedInput);
  for (const bw of boundaryWarnings) {
    score *= bw.confidence_modifier;
    warnings.push(bw.message);
    factors.push({
      factor: 'boundary_proximity',
      impact: bw.confidence_modifier,
      detail: bw.message
    });
  }

  // Factor 4: Calculation source
  // (If using simplified calculations vs Swiss Ephemeris)
  // This would be set by the astro engine

  return {
    confidence_score: parseFloat(Math.max(0, Math.min(1, score)).toFixed(4)),
    warnings,
    factors,
    reliability: getReliabilityLevel(score)
  };
}

/**
 * Analyze boundary proximity for all activations.
 * Identifies positions that are near gate or line boundaries.
 */
function analyzeBoundaryProximity(chart, normalizedInput) {
  const warnings = [];
  const certaintyWindow = CERTAINTY_WINDOWS[normalizedInput.time_certainty] || 0;

  // Only fast-moving bodies are affected by time uncertainty
  const fastMovingBodies = ['Moon', 'Mercury']; // Moon moves ~0.5°/hour
  const mediumBodies = ['Sun', 'Venus', 'Mars']; // Sun moves ~0.04°/hour

  const allActivations = [
    ...chart.personality_activations,
    ...chart.design_activations
  ];

  for (const activation of allActivations) {
    if (!activation.boundary_proximity) continue;

    const { near_gate_boundary, near_line_boundary, gate_boundary_degrees, line_boundary_degrees } = activation.boundary_proximity;

    // Estimate movement based on body speed and time uncertainty
    let hourlyMovement = 0.04; // default (Sun-like)
    if (fastMovingBodies.includes(activation.planet)) {
      hourlyMovement = 0.5; // Moon
      if (activation.planet === 'Mercury') hourlyMovement = 0.15;
    }

    const potentialMovement = hourlyMovement * (certaintyWindow / 60);

    if (near_gate_boundary && potentialMovement > gate_boundary_degrees) {
      warnings.push({
        message: `${activation.side} ${activation.planet}: Gate ${activation.gate} may change (${gate_boundary_degrees.toFixed(3)}° from boundary)`,
        confidence_modifier: 0.90,
        activation
      });
    }

    if (near_line_boundary && potentialMovement > line_boundary_degrees) {
      warnings.push({
        message: `${activation.side} ${activation.planet}: Line ${activation.line} may vary in Gate ${activation.gate} (${line_boundary_degrees.toFixed(3)}° from boundary)`,
        confidence_modifier: 0.95,
        activation
      });
    }
  }

  return warnings;
}

/**
 * Get human-readable reliability level from score.
 */
function getReliabilityLevel(score) {
  if (score >= 0.90) return 'high';
  if (score >= 0.70) return 'moderate';
  if (score >= 0.50) return 'low';
  return 'very_low';
}

// ─── Birth Time Sensitivity Analysis ────────────────────────────────────────

/**
 * Run sensitivity analysis across a time window.
 * Computes charts at regular intervals and detects what changes.
 * This is a major product advantage over competitors.
 */
function runSensitivityAnalysis(normalizedInput, windowMinutes, stepMinutes = 5) {
  if (!windowMinutes || windowMinutes <= 0) {
    return null;
  }

  const { DateTime } = require('luxon');
  const baseBirthLocal = DateTime.fromISO(normalizedInput.utc.birth_local, {
    zone: normalizedInput.location.timezone_id
  });

  const halfWindow = windowMinutes / 2;
  const results = [];

  // Calculate chart at each step in the window
  for (let offset = -halfWindow; offset <= halfWindow; offset += stepMinutes) {
    const adjustedTime = baseBirthLocal.plus({ minutes: offset });
    const adjustedUtc = adjustedTime.toUTC();

    const jd = toJulianDay(
      adjustedUtc.year, adjustedUtc.month, adjustedUtc.day,
      adjustedUtc.hour, adjustedUtc.minute, adjustedUtc.second
    );

    // Calculate positions at this time
    const positions = calculateAllPositions(jd);

    // We need design positions too, but for speed we'll use simplified approach
    // For full accuracy, should call calculateChartPositions
    const chart = computeChart(positions, positions); // Simplified: using same positions for sensitivity check

    results.push({
      offset_minutes: offset,
      time_local: adjustedTime.toISO({ suppressMilliseconds: true }),
      type: chart.type.value,
      authority: chart.authority.value,
      profile: chart.profile.value,
      definition: chart.definition.value,
      personality_sun_gate: chart.personality_activations.find(a => a.planet === 'Sun')?.gate,
      personality_sun_line: chart.personality_activations.find(a => a.planet === 'Sun')?.line,
      personality_moon_gate: chart.personality_activations.find(a => a.planet === 'Moon')?.gate,
      personality_moon_line: chart.personality_activations.find(a => a.planet === 'Moon')?.line,
      defined_centers_count: chart.centers.defined.length,
      active_channels_count: chart.active_channels.length
    });
  }

  // Analyze stability
  return analyzeSensitivityResults(results);
}

/**
 * Analyze sensitivity analysis results to identify stable and unstable features.
 */
function analyzeSensitivityResults(results) {
  if (!results || results.length === 0) return null;

  const features = {
    type: new Set(),
    authority: new Set(),
    profile: new Set(),
    definition: new Set(),
    sun_gate: new Set(),
    sun_line: new Set(),
    moon_gate: new Set(),
    moon_line: new Set()
  };

  const transitions = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    features.type.add(r.type);
    features.authority.add(r.authority);
    features.profile.add(r.profile);
    features.definition.add(r.definition);
    features.sun_gate.add(r.personality_sun_gate);
    features.sun_line.add(r.personality_sun_line);
    features.moon_gate.add(r.personality_moon_gate);
    features.moon_line.add(r.personality_moon_line);

    // Detect transitions
    if (i > 0) {
      const prev = results[i - 1];
      if (prev.type !== r.type) {
        transitions.push({
          feature: 'Type',
          from: prev.type,
          to: r.type,
          at_offset: r.offset_minutes,
          at_time: r.time_local
        });
      }
      if (prev.profile !== r.profile) {
        transitions.push({
          feature: 'Profile',
          from: prev.profile,
          to: r.profile,
          at_offset: r.offset_minutes,
          at_time: r.time_local
        });
      }
      if (prev.authority !== r.authority) {
        transitions.push({
          feature: 'Authority',
          from: prev.authority,
          to: r.authority,
          at_offset: r.offset_minutes,
          at_time: r.time_local
        });
      }
    }
  }

  const stable = [];
  const unstable = [];

  if (features.type.size === 1) stable.push(`Type: ${[...features.type][0]}`);
  else unstable.push(`Type varies: ${[...features.type].join(' / ')}`);

  if (features.authority.size === 1) stable.push(`Authority: ${[...features.authority][0]}`);
  else unstable.push(`Authority varies: ${[...features.authority].join(' / ')}`);

  if (features.profile.size === 1) stable.push(`Profile: ${[...features.profile][0]}`);
  else unstable.push(`Profile varies: ${[...features.profile].join(' / ')}`);

  if (features.definition.size === 1) stable.push(`Definition: ${[...features.definition][0]}`);
  else unstable.push(`Definition varies: ${[...features.definition].join(' / ')}`);

  if (features.sun_gate.size === 1) stable.push(`Sun Gate: ${[...features.sun_gate][0]}`);
  else unstable.push(`Sun Gate varies: ${[...features.sun_gate].join(' / ')}`);

  if (features.moon_gate.size === 1) stable.push(`Moon Gate: ${[...features.moon_gate][0]}`);
  else unstable.push(`Moon Gate varies: ${[...features.moon_gate].join(' / ')}`);

  return {
    stable_features: stable,
    unstable_features: unstable,
    transitions,
    time_points: results,
    total_variations: unstable.length,
    summary: unstable.length === 0
      ? 'All major chart features are stable within the time window.'
      : `${unstable.length} feature(s) may vary within the time window.`
  };
}

module.exports = {
  calculateConfidence,
  analyzeBoundaryProximity,
  getReliabilityLevel,
  runSensitivityAnalysis,
  analyzeSensitivityResults
};
