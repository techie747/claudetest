/**
 * Layer A — Input Normalization Engine
 * Converts user birth data into clean, verified, machine-safe timestamps.
 * Handles geocoding, timezone resolution, and UTC normalization.
 */

const { DateTime } = require('luxon');

// ─── Time Certainty Levels ───────────────────────────────────────────────────
const CERTAINTY_LEVELS = {
  EXACT: 'exact',              // Exact to the minute
  APPROXIMATE_15: 'approx_15', // Within 15 minutes
  APPROXIMATE_60: 'approx_60', // Within 1 hour
  UNKNOWN: 'unknown'           // Birth time unknown
};

const CERTAINTY_WINDOWS = {
  [CERTAINTY_LEVELS.EXACT]: 0,
  [CERTAINTY_LEVELS.APPROXIMATE_15]: 15,
  [CERTAINTY_LEVELS.APPROXIMATE_60]: 60,
  [CERTAINTY_LEVELS.UNKNOWN]: 720 // 12 hours
};

/**
 * Geocode a birth place to lat/lon/timezone using a geocoding service.
 * This implementation uses the free Nominatim API (OpenStreetMap).
 * For production, consider Google Maps Geocoding API or similar.
 */
async function geocodeBirthPlace(city, country) {
  const query = `${city}, ${country}`;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FrequencyIntelligenceEngine/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      throw new Error(`Could not geocode location: ${query}`);
    }

    const result = results[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    // Resolve IANA timezone from coordinates
    const timezoneId = await resolveTimezone(lat, lon);

    return {
      city: city,
      country: country,
      region: result.address?.state || result.address?.region || null,
      lat: lat,
      lon: lon,
      timezone_id: timezoneId,
      display_name: result.display_name
    };
  } catch (error) {
    throw new Error(`Geocoding failed for "${query}": ${error.message}`);
  }
}

/**
 * Resolve IANA timezone ID from coordinates.
 * Uses a timezone lookup approach. For production, use a dedicated timezone API
 * or the `geo-tz` npm package.
 */
async function resolveTimezone(lat, lon) {
  try {
    // Try using the geo-tz library if available
    const geoTz = require('geo-tz');
    const timezones = geoTz.find(lat, lon);
    if (timezones && timezones.length > 0) {
      return timezones[0];
    }
  } catch (e) {
    // geo-tz not installed, fall back to API
  }

  // Fallback: use a free timezone API
  try {
    const response = await fetch(
      `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.timeZone) return data.timeZone;
    }
  } catch (e) {
    // API unavailable
  }

  throw new Error(`Could not resolve timezone for coordinates (${lat}, ${lon}). ` +
    `Install the 'geo-tz' package for offline timezone resolution.`);
}

/**
 * Validate and normalize birth input data.
 */
function validateBirthInput(input) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!input.birth_date) errors.push('birth_date is required (YYYY-MM-DD)');
  if (!input.birth_city) errors.push('birth_city is required');
  if (!input.birth_country) errors.push('birth_country is required');

  // Validate date format
  if (input.birth_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(input.birth_date)) {
      errors.push('birth_date must be in YYYY-MM-DD format');
    }
  }

  // Validate time format
  if (input.birth_time) {
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timeRegex.test(input.birth_time)) {
      errors.push('birth_time must be in HH:MM or HH:MM:SS format');
    }
  }

  // Check certainty level
  const certainty = input.time_certainty || CERTAINTY_LEVELS.EXACT;
  if (!Object.values(CERTAINTY_LEVELS).includes(certainty)) {
    errors.push(`Invalid time_certainty. Must be one of: ${Object.values(CERTAINTY_LEVELS).join(', ')}`);
  }

  // Warnings for missing optional data
  if (!input.birth_time) {
    warnings.push('No birth time provided. Chart accuracy will be significantly reduced.');
  }

  if (certainty === CERTAINTY_LEVELS.UNKNOWN) {
    warnings.push('Birth time unknown. Only broad features (Type) may be reliable.');
  } else if (certainty === CERTAINTY_LEVELS.APPROXIMATE_60) {
    warnings.push('Birth time approximate within 1 hour. Profile and some lines may vary.');
  } else if (certainty === CERTAINTY_LEVELS.APPROXIMATE_15) {
    warnings.push('Birth time approximate within 15 minutes. Some boundary lines may vary.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Convert local birth time to UTC with full historical timezone handling.
 * Luxon handles DST and historical timezone rules via IANA data.
 */
function convertToUTC(birthDate, birthTime, timezoneId) {
  const timeStr = birthTime || '12:00'; // Default to noon if unknown
  const localStr = `${birthDate}T${timeStr}`;

  const local = DateTime.fromISO(localStr, { zone: timezoneId });

  if (!local.isValid) {
    throw new Error(
      `Invalid date/time/timezone combination: ${localStr} in ${timezoneId}. ` +
      `Reason: ${local.invalidReason}`
    );
  }

  const utc = local.toUTC();

  return {
    birth_local: local.toISO({ suppressMilliseconds: true }),
    birth_utc: utc.toISO({ suppressMilliseconds: true }),
    timezone_id: timezoneId,
    utc_offset: local.toFormat('ZZ'),
    dst_active: local.isInDST,
    julian_day: toJulianDay(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second)
  };
}

/**
 * Calculate Julian Day Number from UTC date/time.
 * Required for astronomical calculations.
 */
function toJulianDay(year, month, day, hour = 0, minute = 0, second = 0) {
  const decimalDay = day + (hour + minute / 60 + second / 3600) / 24;

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         decimalDay + B - 1524.5;
}

/**
 * Full input normalization pipeline.
 * Takes raw user input and produces a clean, validated, UTC-normalized birth record.
 */
async function normalizeBirthInput(input) {
  // Step 1: Validate
  const validation = validateBirthInput(input);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  // Step 2: Geocode (if timezone not already provided)
  let geoData;
  if (input.timezone_id && input.lat && input.lon) {
    geoData = {
      city: input.birth_city,
      country: input.birth_country,
      lat: input.lat,
      lon: input.lon,
      timezone_id: input.timezone_id
    };
  } else {
    geoData = await geocodeBirthPlace(input.birth_city, input.birth_country);
  }

  // Step 3: Convert to UTC
  const utcData = convertToUTC(
    input.birth_date,
    input.birth_time,
    geoData.timezone_id
  );

  // Step 4: Build normalized record
  const certainty = input.time_certainty || CERTAINTY_LEVELS.EXACT;

  return {
    success: true,
    normalized: {
      birth_date: input.birth_date,
      birth_time: input.birth_time || '12:00',
      birth_time_provided: !!input.birth_time,
      time_certainty: certainty,
      certainty_window_minutes: CERTAINTY_WINDOWS[certainty],
      location: geoData,
      utc: utcData
    },
    warnings: validation.warnings
  };
}

module.exports = {
  CERTAINTY_LEVELS,
  CERTAINTY_WINDOWS,
  geocodeBirthPlace,
  resolveTimezone,
  validateBirthInput,
  convertToUTC,
  toJulianDay,
  normalizeBirthInput
};
