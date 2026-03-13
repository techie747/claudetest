/**
 * Human Design Calculation Pipeline
 * Orchestrates the full calculation flow from raw birth input to complete chart.
 *
 * Architecture:
 *   Birth Input → Geocoding + Timezone → UTC Normalization → Astronomical Engine
 *   → Design Date Solver → Gate/Line Mapping → Channel/Center Graph
 *   → Type/Authority/Profile Rule Engine → Confidence + Sensitivity → Output
 */

const { normalizeBirthInput, CERTAINTY_LEVELS, CERTAINTY_WINDOWS } = require('./input-normalizer');
const { calculateChartPositions } = require('./astro-engine');
const { computeChart } = require('./hd-engine');
const { calculateConfidence, runSensitivityAnalysis } = require('./confidence-engine');

/**
 * Run the complete Human Design calculation pipeline.
 *
 * @param {Object} birthInput - Raw birth input from user
 * @param {string} birthInput.birth_date - Date of birth (YYYY-MM-DD)
 * @param {string} [birthInput.birth_time] - Time of birth (HH:MM or HH:MM:SS)
 * @param {string} birthInput.birth_city - City of birth
 * @param {string} birthInput.birth_country - Country of birth
 * @param {string} [birthInput.time_certainty] - Time certainty level
 * @param {string} [birthInput.timezone_id] - IANA timezone ID (optional, auto-resolved)
 * @param {number} [birthInput.lat] - Latitude (optional, auto-resolved)
 * @param {number} [birthInput.lon] - Longitude (optional, auto-resolved)
 * @param {Object} [options] - Pipeline options
 * @param {boolean} [options.include_sensitivity] - Run sensitivity analysis
 * @param {boolean} [options.include_substructure] - Include color/tone/base in output
 * @param {boolean} [options.include_audit] - Include detailed audit trail
 * @returns {Object} Complete chart result with confidence scoring
 */
async function calculateHumanDesignChart(birthInput, options = {}) {
  const startTime = Date.now();
  const audit = [];

  try {
    // ═══ Layer A: Input Normalization ═══
    audit.push({ step: 'input_normalization', status: 'started', timestamp: Date.now() });

    const normalizedResult = await normalizeBirthInput(birthInput);

    if (!normalizedResult.success) {
      return {
        success: false,
        errors: normalizedResult.errors,
        warnings: normalizedResult.warnings
      };
    }

    const normalized = normalizedResult.normalized;
    audit.push({
      step: 'input_normalization',
      status: 'completed',
      data: {
        birth_utc: normalized.utc.birth_utc,
        timezone: normalized.location.timezone_id,
        julian_day: normalized.utc.julian_day
      }
    });

    // ═══ Layer B: Astronomical Calculation ═══
    audit.push({ step: 'astronomical_calculation', status: 'started', timestamp: Date.now() });

    const astroResult = calculateChartPositions(normalized.utc.julian_day);

    audit.push({
      step: 'astronomical_calculation',
      status: 'completed',
      data: {
        personality_sun: astroResult.personality.positions.Sun,
        design_sun: astroResult.design.positions.Sun,
        design_jd: astroResult.design.jd,
        calculation_source: astroResult.source,
        design_solver_precision: astroResult.design.solver.precision_degrees
      }
    });

    // ═══ Layer C: Human Design Mapping ═══
    audit.push({ step: 'hd_mapping', status: 'started', timestamp: Date.now() });

    const chart = computeChart(
      astroResult.personality.positions,
      astroResult.design.positions
    );

    audit.push({
      step: 'hd_mapping',
      status: 'completed',
      data: {
        type: chart.type.value,
        authority: chart.authority.value,
        profile: chart.profile.value,
        definition: chart.definition.value,
        channels_count: chart.active_channels.length,
        defined_centers: chart.centers.defined
      }
    });

    // ═══ Confidence Scoring ═══
    audit.push({ step: 'confidence_scoring', status: 'started', timestamp: Date.now() });

    const confidence = calculateConfidence(chart, normalized);

    audit.push({
      step: 'confidence_scoring',
      status: 'completed',
      data: {
        score: confidence.confidence_score,
        reliability: confidence.reliability,
        warnings_count: confidence.warnings.length
      }
    });

    // ═══ Sensitivity Analysis (optional) ═══
    let sensitivity = null;
    if (options.include_sensitivity && normalized.certainty_window_minutes > 0) {
      audit.push({ step: 'sensitivity_analysis', status: 'started', timestamp: Date.now() });

      sensitivity = runSensitivityAnalysis(
        normalized,
        normalized.certainty_window_minutes
      );

      audit.push({
        step: 'sensitivity_analysis',
        status: 'completed',
        data: {
          stable_count: sensitivity?.stable_features?.length || 0,
          unstable_count: sensitivity?.unstable_features?.length || 0
        }
      });
    }

    // ═══ Build Output ═══
    const output = {
      success: true,

      // Core chart data
      chart: {
        type: chart.type,
        authority: chart.authority,
        profile: chart.profile,
        definition: chart.definition,
        incarnation_cross: chart.incarnation_cross,

        // Channels and Centers
        active_channels: chart.active_channels,
        centers: chart.centers,

        // Activations
        personality: formatActivations(chart.personality_activations, options.include_substructure),
        design: formatActivations(chart.design_activations, options.include_substructure),
      },

      // Confidence
      confidence,

      // Sensitivity (if requested)
      sensitivity,

      // Metadata
      meta: {
        birth_input: {
          date: birthInput.birth_date,
          time: birthInput.birth_time || 'not provided',
          city: birthInput.birth_city,
          country: birthInput.birth_country,
          time_certainty: normalized.time_certainty
        },
        normalized: {
          birth_utc: normalized.utc.birth_utc,
          birth_local: normalized.utc.birth_local,
          timezone_id: normalized.location.timezone_id,
          dst_active: normalized.utc.dst_active,
          julian_day: normalized.utc.julian_day,
          location: {
            lat: normalized.location.lat,
            lon: normalized.location.lon
          }
        },
        calculation: {
          source: astroResult.source,
          precision_note: astroResult.precision_note,
          design_date_jd: astroResult.design.jd,
          design_solver_precision: astroResult.design.solver.precision_degrees,
          computation_time_ms: Date.now() - startTime
        }
      },

      // Warnings (aggregated)
      warnings: [
        ...normalizedResult.warnings,
        ...confidence.warnings
      ]
    };

    // Include audit trail if requested
    if (options.include_audit) {
      output.audit = audit;
    }

    return output;

  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      warnings: [],
      audit: options.include_audit ? audit : undefined,
      meta: {
        computation_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * Format activations for output, optionally including substructure.
 */
function formatActivations(activations, includeSubstructure = false) {
  return activations.map(a => {
    const base = {
      planet: a.planet,
      gate: a.gate,
      line: a.line,
      center: a.center,
      longitude: a.longitude,
      zodiac: a.zodiac ? `${a.zodiac.degrees}°${a.zodiac.minutes}'${a.zodiac.seconds}" ${a.zodiac.sign}` : null
    };

    if (includeSubstructure) {
      base.color = a.color;
      base.tone = a.tone;
      base.base = a.base;
    }

    return base;
  });
}

/**
 * Quick chart calculation without geocoding (for pre-resolved inputs).
 * Use this when you already have UTC time and don't need geocoding.
 */
function calculateChartFromUTC(birthDateUTC, options = {}) {
  const { DateTime } = require('luxon');
  const { toJulianDay } = require('./input-normalizer');

  const dt = DateTime.fromISO(birthDateUTC, { zone: 'utc' });
  if (!dt.isValid) {
    throw new Error(`Invalid UTC datetime: ${birthDateUTC}`);
  }

  const jd = toJulianDay(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second);
  const astroResult = calculateChartPositions(jd);
  const chart = computeChart(
    astroResult.personality.positions,
    astroResult.design.positions
  );

  return {
    success: true,
    chart: {
      type: chart.type,
      authority: chart.authority,
      profile: chart.profile,
      definition: chart.definition,
      incarnation_cross: chart.incarnation_cross,
      active_channels: chart.active_channels,
      centers: chart.centers,
      personality: formatActivations(chart.personality_activations, options.include_substructure),
      design: formatActivations(chart.design_activations, options.include_substructure)
    },
    meta: {
      birth_utc: birthDateUTC,
      julian_day: jd,
      source: astroResult.source
    }
  };
}

module.exports = {
  calculateHumanDesignChart,
  calculateChartFromUTC
};
