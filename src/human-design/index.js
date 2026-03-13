/**
 * Frequency Intelligence Engine — Human Design Module
 * Main entry point for the Human Design calculation pipeline.
 */

const { calculateHumanDesignChart, calculateChartFromUTC } = require('./pipeline');
const { CERTAINTY_LEVELS } = require('./input-normalizer');
const { computeChart, longitudeToGateLine } = require('./hd-engine');
const { calculateChartPositions, calculateAllPositions } = require('./astro-engine');
const data = require('./data');

module.exports = {
  // Main pipeline
  calculateHumanDesignChart,
  calculateChartFromUTC,

  // Sub-engines (for advanced usage)
  computeChart,
  longitudeToGateLine,
  calculateChartPositions,
  calculateAllPositions,

  // Constants
  CERTAINTY_LEVELS,

  // Reference data
  data
};
