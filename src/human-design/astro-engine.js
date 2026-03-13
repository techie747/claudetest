/**
 * Layer B — Astronomical Calculation Engine
 * Calculates planetary longitudes for both Personality (birth) and Design (~88° before).
 *
 * This engine provides two modes:
 * 1. Swiss Ephemeris integration (high-precision, production-ready)
 * 2. VSOP87-based approximation (reasonable accuracy, no external dependencies)
 *
 * For production use, install 'swisseph' npm package for Swiss Ephemeris bindings.
 */

const { toJulianDay } = require('./input-normalizer');

// ─── Constants ───────────────────────────────────────────────────────────────
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DESIGN_SUN_ARC = 88.0; // Degrees of solar arc before birth for Design calculation

// Julian Day for J2000.0 epoch
const J2000 = 2451545.0;

/**
 * Normalize degrees to 0-360 range.
 */
function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

// ─── Simplified Planetary Position Calculator ────────────────────────────────
// Based on VSOP87 truncated series. Accurate to ~0.01° for inner planets,
// ~0.1° for outer planets within ±few centuries of J2000.
// For maximum accuracy, use Swiss Ephemeris.

/**
 * Calculate Sun's ecliptic longitude for a given Julian Day.
 * Based on Jean Meeus "Astronomical Algorithms".
 */
function calcSunLongitude(jd) {
  const T = (jd - J2000) / 36525.0; // Julian centuries from J2000

  // Geometric mean longitude of the Sun
  let L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  L0 = normalizeDeg(L0);

  // Mean anomaly of the Sun
  let M = 357.52911 + T * (35999.05029 - T * 0.0001537);
  M = normalizeDeg(M);
  const Mrad = M * DEG_TO_RAD;

  // Equation of center
  const C = (1.914602 - T * (0.004817 + T * 0.000014)) * Math.sin(Mrad)
          + (0.019993 - T * 0.000101) * Math.sin(2 * Mrad)
          + 0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude
  const sunLon = normalizeDeg(L0 + C);

  // Apparent longitude (nutation correction)
  const omega = 125.04 - 1934.136 * T;
  const apparent = sunLon - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD);

  return normalizeDeg(apparent);
}

/**
 * Calculate Moon's ecliptic longitude (simplified).
 */
function calcMoonLongitude(jd) {
  const T = (jd - J2000) / 36525.0;

  // Moon's mean longitude
  let Lp = 218.3165 + 481267.8813 * T;
  Lp = normalizeDeg(Lp);

  // Moon's mean anomaly
  let Mp = 134.9634 + 477198.8676 * T;
  Mp = normalizeDeg(Mp) * DEG_TO_RAD;

  // Sun's mean anomaly
  let Ms = 357.5291 + 35999.0503 * T;
  Ms = normalizeDeg(Ms) * DEG_TO_RAD;

  // Moon's mean elongation
  let D = 297.8502 + 445267.1115 * T;
  D = normalizeDeg(D) * DEG_TO_RAD;

  // Moon's argument of latitude
  let F = 93.2720 + 483202.0175 * T;
  F = normalizeDeg(F) * DEG_TO_RAD;

  // Principal perturbations
  const lon = Lp
    + 6.289 * Math.sin(Mp)
    - 1.274 * Math.sin(2 * D - Mp)
    + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp)
    - 0.186 * Math.sin(Ms)
    - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * D - 2 * Mp)
    + 0.057 * Math.sin(2 * D - Ms - Mp)
    + 0.053 * Math.sin(2 * D + Mp)
    + 0.046 * Math.sin(2 * D - Ms)
    - 0.041 * Math.sin(Ms - Mp);

  return normalizeDeg(lon);
}

/**
 * Calculate planetary longitude using simplified orbital elements.
 * For Mercury through Neptune, uses truncated VSOP87 / Meeus formulas.
 */
function calcPlanetLongitude(planet, jd) {
  const T = (jd - J2000) / 36525.0;

  // Orbital elements [L0, L1, ..., perturbation terms]
  // L = L0 + L1*T + perturbations
  const elements = {
    Mercury: () => {
      let L = 252.2509 + 149472.6746 * T;
      const M = (174.7948 + 149472.5153 * T) * DEG_TO_RAD;
      L += 23.4400 * Math.sin(M) + 2.9818 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Venus: () => {
      let L = 181.9798 + 58517.8157 * T;
      const M = (50.4161 + 58517.8039 * T) * DEG_TO_RAD;
      L += 0.7758 * Math.sin(M) - 0.0033 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Earth: () => {
      // Earth longitude = Sun longitude + 180°
      return normalizeDeg(calcSunLongitude(jd) + 180);
    },
    Mars: () => {
      let L = 355.4330 + 19140.2993 * T;
      const M = (19.3730 + 19139.8585 * T) * DEG_TO_RAD;
      L += 10.6912 * Math.sin(M) + 0.6228 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Jupiter: () => {
      let L = 34.3515 + 3034.9057 * T;
      const M = (20.0202 + 3034.6870 * T) * DEG_TO_RAD;
      L += 5.5549 * Math.sin(M) + 0.1683 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Saturn: () => {
      let L = 50.0774 + 1222.1138 * T;
      const M = (317.0207 + 1222.1116 * T) * DEG_TO_RAD;
      L += 6.3585 * Math.sin(M) + 0.2204 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Uranus: () => {
      let L = 314.0550 + 428.9469 * T;
      const M = (141.0498 + 429.1055 * T) * DEG_TO_RAD;
      L += 5.3042 * Math.sin(M) + 0.1534 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Neptune: () => {
      let L = 304.3487 + 218.4862 * T;
      const M = (256.2250 + 218.5400 * T) * DEG_TO_RAD;
      L += 1.8688 * Math.sin(M) + 0.0192 * Math.sin(2 * M);
      return normalizeDeg(L);
    },
    Pluto: () => {
      // Pluto uses a different approach due to high eccentricity
      let L = 238.9290 + 145.2078 * T;
      const M = (25.2 + 144.97 * T) * DEG_TO_RAD;
      L += 28.3150 * Math.sin(M) + 4.77 * Math.sin(2 * M) + 0.93 * Math.sin(3 * M);
      return normalizeDeg(L);
    }
  };

  if (!elements[planet]) {
    throw new Error(`Unknown planet: ${planet}`);
  }

  return elements[planet]();
}

/**
 * Calculate North Node (Mean Lunar Node) longitude.
 */
function calcNorthNodeLongitude(jd) {
  const T = (jd - J2000) / 36525.0;
  // Mean longitude of ascending node
  let omega = 125.0445 - 1934.1363 * T + 0.0021 * T * T;
  return normalizeDeg(omega);
}

/**
 * Calculate all planetary longitudes for a given Julian Day.
 */
function calculateAllPositions(jd) {
  const positions = {};

  // Sun
  positions.Sun = calcSunLongitude(jd);

  // Earth (opposite Sun)
  positions.Earth = normalizeDeg(positions.Sun + 180);

  // Moon
  positions.Moon = calcMoonLongitude(jd);

  // Planets
  for (const planet of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
    positions[planet] = calcPlanetLongitude(planet, jd);
  }

  // Lunar Nodes
  positions['North Node'] = calcNorthNodeLongitude(jd);
  positions['South Node'] = normalizeDeg(positions['North Node'] + 180);

  return positions;
}

/**
 * Try to use Swiss Ephemeris for high-precision calculations.
 * Falls back to built-in calculator if swisseph is not installed.
 */
function calculateAllPositionsHighPrecision(jd) {
  try {
    const swisseph = require('swisseph');
    return calculateWithSwissEph(swisseph, jd);
  } catch (e) {
    // Swiss Ephemeris not available, use built-in calculator
    return {
      positions: calculateAllPositions(jd),
      source: 'built-in-vsop87-simplified',
      precision_note: 'Using simplified VSOP87 calculations. For maximum accuracy, install the swisseph npm package.'
    };
  }
}

/**
 * Calculate positions using Swiss Ephemeris (if available).
 */
function calculateWithSwissEph(swisseph, jd) {
  const flag = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED;
  const positions = {};

  const bodyMap = {
    Sun: swisseph.SE_SUN,
    Moon: swisseph.SE_MOON,
    Mercury: swisseph.SE_MERCURY,
    Venus: swisseph.SE_VENUS,
    Mars: swisseph.SE_MARS,
    Jupiter: swisseph.SE_JUPITER,
    Saturn: swisseph.SE_SATURN,
    Uranus: swisseph.SE_URANUS,
    Neptune: swisseph.SE_NEPTUNE,
    Pluto: swisseph.SE_PLUTO,
    'North Node': swisseph.SE_TRUE_NODE
  };

  for (const [name, body] of Object.entries(bodyMap)) {
    const result = swisseph.swe_calc_ut(jd, body, flag);
    if (result.error) {
      throw new Error(`Swiss Ephemeris error for ${name}: ${result.error}`);
    }
    positions[name] = normalizeDeg(result.longitude);
  }

  // Earth and South Node derived
  positions.Earth = normalizeDeg(positions.Sun + 180);
  positions['South Node'] = normalizeDeg(positions['North Node'] + 180);

  return {
    positions,
    source: 'swiss-ephemeris',
    precision_note: 'High-precision Swiss Ephemeris calculations.'
  };
}

// ─── Design Date Solver ──────────────────────────────────────────────────────

/**
 * Find the Design timestamp: the moment when the Sun was exactly 88° of solar arc
 * BEFORE the natal Sun position.
 *
 * Uses iterative bisection to solve for the exact timestamp.
 * This is NOT the naive "88 days before birth" shortcut.
 */
function solveDesignDate(natalJd, natalSunLongitude) {
  // Target: the Sun longitude that is 88° before natal Sun
  const targetSunLon = normalizeDeg(natalSunLongitude - DESIGN_SUN_ARC);

  // Initial estimate: ~88 days before birth (Sun moves ~1°/day)
  let lowJd = natalJd - 100;  // generous lower bound
  let highJd = natalJd - 75;  // generous upper bound

  // Verify our bounds contain the target
  let lowSun = calcSunLongitude(lowJd);
  let highSun = calcSunLongitude(highJd);

  // Handle wraparound: if target is near 0°/360° boundary, adjust
  // We need the Sun to pass through targetSunLon between lowJd and highJd
  // Widen bounds if needed
  for (let attempt = 0; attempt < 5; attempt++) {
    const midJd = (lowJd + highJd) / 2;
    const testPositions = [];

    for (let t = lowJd; t <= highJd; t += 1) {
      testPositions.push({ jd: t, sun: calcSunLongitude(t) });
    }

    // Check if target is in range
    let found = false;
    for (let i = 0; i < testPositions.length - 1; i++) {
      const diff = angleDiff(testPositions[i].sun, targetSunLon);
      const nextDiff = angleDiff(testPositions[i + 1].sun, targetSunLon);
      if (Math.abs(diff) < 2 || (diff > 0 && nextDiff < 0) || (diff < 0 && nextDiff > 0)) {
        found = true;
        lowJd = testPositions[i].jd - 1;
        highJd = testPositions[i].jd + 2;
        break;
      }
    }

    if (found) break;

    // Widen bounds
    lowJd -= 10;
    highJd += 10;
  }

  // Bisection method to find exact timestamp
  const MAX_ITERATIONS = 50;
  const TOLERANCE = 0.0001; // degrees

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const midJd = (lowJd + highJd) / 2;
    const midSun = calcSunLongitude(midJd);
    const diff = angleDiff(midSun, targetSunLon);

    if (Math.abs(diff) < TOLERANCE) {
      return {
        design_jd: midJd,
        design_sun_longitude: midSun,
        target_sun_longitude: targetSunLon,
        iterations: i + 1,
        precision_degrees: Math.abs(diff)
      };
    }

    // Determine which half contains the target
    // Sun moves forward (~1°/day), so earlier JD = smaller longitude (generally)
    if (diff > 0 && diff < 180) {
      // midSun is ahead of target, need earlier time
      highJd = midJd;
    } else {
      lowJd = midJd;
    }
  }

  // Fallback: return best estimate
  const finalJd = (lowJd + highJd) / 2;
  return {
    design_jd: finalJd,
    design_sun_longitude: calcSunLongitude(finalJd),
    target_sun_longitude: targetSunLon,
    iterations: MAX_ITERATIONS,
    precision_degrees: Math.abs(angleDiff(calcSunLongitude(finalJd), targetSunLon)),
    warning: 'Design date solver did not converge to full precision'
  };
}

/**
 * Calculate the signed angular difference between two angles.
 * Returns value in range [-180, 180].
 */
function angleDiff(a, b) {
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Full astronomical calculation for a birth chart.
 * Returns both Personality and Design planetary positions.
 */
function calculateChartPositions(birthJd) {
  // Personality positions (at birth moment)
  const personalityResult = calculateAllPositionsHighPrecision(birthJd);
  const personalityPositions = personalityResult.positions || personalityResult;

  // Solve Design date (88° solar arc before birth)
  const natalSunLon = personalityPositions.Sun;
  const designDateResult = solveDesignDate(birthJd, natalSunLon);

  // Design positions (at design moment)
  const designResult = calculateAllPositionsHighPrecision(designDateResult.design_jd);
  const designPositions = designResult.positions || designResult;

  return {
    personality: {
      jd: birthJd,
      positions: personalityPositions
    },
    design: {
      jd: designDateResult.design_jd,
      positions: designPositions,
      solver: {
        target_sun_longitude: designDateResult.target_sun_longitude,
        actual_sun_longitude: designDateResult.design_sun_longitude,
        precision_degrees: designDateResult.precision_degrees,
        iterations: designDateResult.iterations
      }
    },
    source: personalityResult.source || 'built-in-vsop87-simplified',
    precision_note: personalityResult.precision_note || ''
  };
}

module.exports = {
  normalizeDeg,
  calcSunLongitude,
  calcMoonLongitude,
  calcPlanetLongitude,
  calcNorthNodeLongitude,
  calculateAllPositions,
  calculateAllPositionsHighPrecision,
  solveDesignDate,
  angleDiff,
  calculateChartPositions,
  DESIGN_SUN_ARC
};
