/**
 * Layer C — Human Design Mapping Engine
 * Maps planetary longitudes to gates, lines, channels, centers, type, authority, profile, definition.
 * All logic is deterministic and rule-based.
 */

const {
  GATE_SEQUENCE, WHEEL_START_DEG, GATE_SPAN, LINE_SPAN,
  GATE_BOUNDARIES, GATE_TO_CENTER, CHANNELS, CENTERS,
  MOTOR_CENTERS, PROFILE_NAMES, PROFILE_TO_CROSS_TYPE,
  getZodiacSign
} = require('./data');

const { normalizeDeg } = require('./astro-engine');

// ─── Gate and Line Mapping ───────────────────────────────────────────────────

/**
 * Map an ecliptic longitude to a Human Design gate and line.
 * Uses the canonical gate boundary table.
 */
function longitudeToGateLine(longitude) {
  const lon = normalizeDeg(longitude);

  // Calculate position relative to wheel start
  let offset = lon - WHEEL_START_DEG;
  if (offset < 0) offset += 360;

  // Determine gate index
  const gateIndex = Math.floor(offset / GATE_SPAN);
  const gate = GATE_SEQUENCE[gateIndex];

  // Determine line within gate
  const withinGate = offset - (gateIndex * GATE_SPAN);
  const line = Math.floor(withinGate / LINE_SPAN) + 1;

  // Calculate color, tone, base (substructure)
  const withinLine = withinGate - ((line - 1) * LINE_SPAN);
  const colorSpan = LINE_SPAN / 6;
  const color = Math.floor(withinLine / colorSpan) + 1;

  const withinColor = withinLine - ((color - 1) * colorSpan);
  const toneSpan = colorSpan / 6;
  const tone = Math.floor(withinColor / toneSpan) + 1;

  const withinTone = withinColor - ((tone - 1) * toneSpan);
  const baseSpan = toneSpan / 5;
  const base = Math.floor(withinTone / baseSpan) + 1;

  return {
    gate,
    line: Math.min(line, 6), // Clamp to 6
    color: Math.min(color, 6),
    tone: Math.min(tone, 6),
    base: Math.min(base, 5),
    center: GATE_TO_CENTER[gate],
    longitude: parseFloat(lon.toFixed(4)),
    zodiac: getZodiacSign(lon),
    boundary_proximity: getBoundaryProximity(withinGate, GATE_SPAN, withinLine, LINE_SPAN)
  };
}

/**
 * Check how close a position is to gate or line boundaries.
 * Returns proximity info for confidence scoring.
 */
function getBoundaryProximity(withinGate, gateSpan, withinLine, lineSpan) {
  const gateBoundaryDist = Math.min(withinGate, gateSpan - withinGate);
  const lineBoundaryDist = Math.min(
    withinLine % lineSpan,
    lineSpan - (withinLine % lineSpan)
  );

  return {
    gate_boundary_degrees: parseFloat(gateBoundaryDist.toFixed(4)),
    line_boundary_degrees: parseFloat(lineBoundaryDist.toFixed(4)),
    near_gate_boundary: gateBoundaryDist < 0.5,
    near_line_boundary: lineBoundaryDist < 0.15
  };
}

// ─── Activation Building ────────────────────────────────────────────────────

/**
 * Build activations from planetary positions for one side (personality or design).
 */
function buildActivations(positions, side) {
  const activations = [];

  for (const [planet, longitude] of Object.entries(positions)) {
    const mapping = longitudeToGateLine(longitude);
    activations.push({
      side,
      planet,
      ...mapping
    });
  }

  return activations;
}

// ─── Channel Determination ──────────────────────────────────────────────────

/**
 * Determine active channels from all activations (personality + design combined).
 */
function determineChannels(allActivations) {
  // Collect all activated gates
  const activatedGates = new Set();
  const gateActivations = {}; // gate → list of activations

  for (const activation of allActivations) {
    activatedGates.add(activation.gate);
    if (!gateActivations[activation.gate]) {
      gateActivations[activation.gate] = [];
    }
    gateActivations[activation.gate].push(activation);
  }

  // Check each channel definition
  const activeChannels = [];

  for (const channel of CHANNELS) {
    const [gateA, gateB] = channel.gates;
    if (activatedGates.has(gateA) && activatedGates.has(gateB)) {
      activeChannels.push({
        ...channel,
        gate_a_activations: gateActivations[gateA],
        gate_b_activations: gateActivations[gateB]
      });
    }
  }

  return activeChannels;
}

// ─── Center Determination ───────────────────────────────────────────────────

/**
 * Determine defined centers from active channels.
 * A center is defined when at least one complete channel connected to it is active.
 */
function determineDefinedCenters(activeChannels) {
  const definedCenters = new Set();

  for (const channel of activeChannels) {
    definedCenters.add(channel.centers[0]);
    definedCenters.add(channel.centers[1]);
  }

  // Build full center status
  const centerStatus = {};
  for (const [key, center] of Object.entries(CENTERS)) {
    centerStatus[center.name] = {
      defined: definedCenters.has(center.name),
      type: center.type,
      motor: center.motor
    };
  }

  return {
    defined: Array.from(definedCenters),
    undefined: Object.values(CENTERS)
      .map(c => c.name)
      .filter(name => !definedCenters.has(name)),
    status: centerStatus
  };
}

// ─── Type Determination ─────────────────────────────────────────────────────

/**
 * Determine Human Design Type from center/channel configuration.
 * Strict rule engine, not freeform inference.
 */
function determineType(centersInfo, activeChannels) {
  const defined = new Set(centersInfo.defined);

  // Reflector: no centers defined
  if (defined.size === 0) {
    return {
      value: 'Reflector',
      reason: ['No centers are defined']
    };
  }

  const sacralDefined = defined.has('Sacral');
  const motorToThroat = hasMotorToThroatConnection(activeChannels, centersInfo);

  // Generator: Sacral defined, no motor-to-throat
  if (sacralDefined && !motorToThroat) {
    return {
      value: 'Generator',
      reason: [
        'Sacral center is defined',
        'No qualifying motor-to-throat connection'
      ]
    };
  }

  // Manifesting Generator: Sacral defined + motor-to-throat
  if (sacralDefined && motorToThroat) {
    return {
      value: 'Manifesting Generator',
      reason: [
        'Sacral center is defined',
        'Has motor-to-throat connection via: ' + motorToThroat.path
      ]
    };
  }

  // Manifestor: No sacral, but motor-to-throat
  if (!sacralDefined && motorToThroat) {
    return {
      value: 'Manifestor',
      reason: [
        'Sacral center is NOT defined',
        'Has motor-to-throat connection via: ' + motorToThroat.path
      ]
    };
  }

  // Projector: No sacral, no motor-to-throat
  return {
    value: 'Projector',
    reason: [
      'Sacral center is NOT defined',
      'No motor-to-throat connection'
    ]
  };
}

/**
 * Check if there is a motor center connected to the Throat,
 * either directly or through a chain of defined centers.
 */
function hasMotorToThroatConnection(activeChannels, centersInfo) {
  const defined = new Set(centersInfo.defined);
  if (!defined.has('Throat')) return null;

  // Build adjacency graph of defined centers
  const adj = {};
  for (const center of defined) {
    adj[center] = new Set();
  }

  for (const channel of activeChannels) {
    const [c1, c2] = channel.centers;
    if (defined.has(c1) && defined.has(c2)) {
      adj[c1].add(c2);
      adj[c2].add(c1);
    }
  }

  // BFS from Throat to find any motor center
  const visited = new Set(['Throat']);
  const queue = ['Throat'];
  const parent = { 'Throat': null };

  while (queue.length > 0) {
    const current = queue.shift();

    if (MOTOR_CENTERS.includes(current) && current !== 'Throat') {
      // Found a motor! Trace path
      const path = [];
      let node = current;
      while (node) {
        path.unshift(node);
        node = parent[node];
      }
      return { connected: true, motor: current, path: path.join(' → ') };
    }

    if (adj[current]) {
      for (const neighbor of adj[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent[neighbor] = current;
          queue.push(neighbor);
        }
      }
    }
  }

  return null;
}

// ─── Authority Determination ────────────────────────────────────────────────

/**
 * Determine Authority based on center configuration and type.
 * Follows strict precedence rules.
 */
function determineAuthority(centersInfo, typeValue, activeChannels) {
  const defined = new Set(centersInfo.defined);

  // Reflector → Lunar authority
  if (typeValue === 'Reflector') {
    return {
      value: 'Lunar',
      reason: ['Reflector type always has Lunar authority', 'No centers defined']
    };
  }

  // 1. Emotional (Solar Plexus defined)
  if (defined.has('Solar Plexus')) {
    return {
      value: 'Emotional',
      reason: ['Solar Plexus center is defined (highest precedence)']
    };
  }

  // 2. Sacral (Sacral defined, for Generators/MGs)
  if (defined.has('Sacral') && (typeValue === 'Generator' || typeValue === 'Manifesting Generator')) {
    return {
      value: 'Sacral',
      reason: ['Solar Plexus undefined', 'Sacral center is defined', `Type is ${typeValue}`]
    };
  }

  // 3. Splenic (Spleen defined)
  if (defined.has('Spleen')) {
    return {
      value: 'Splenic',
      reason: ['Solar Plexus undefined', 'Sacral undefined or non-Generator type', 'Spleen center is defined']
    };
  }

  // 4. Ego/Heart authority
  if (defined.has('Heart')) {
    // Check if Heart is connected to Throat
    const heartToThroat = activeChannels.some(ch =>
      ch.centers.includes('Heart') && ch.centers.includes('Throat')
    );

    if (heartToThroat) {
      return {
        value: 'Ego Manifested',
        reason: ['Heart center is defined', 'Heart is connected to Throat']
      };
    }
    return {
      value: 'Ego Projected',
      reason: ['Heart center is defined', 'Heart is NOT connected to Throat']
    };
  }

  // 5. Self-Projected (G center connected to Throat)
  if (defined.has('G')) {
    const gToThroat = activeChannels.some(ch =>
      ch.centers.includes('G') && ch.centers.includes('Throat')
    );

    if (gToThroat) {
      return {
        value: 'Self-Projected',
        reason: ['G center is defined', 'G is connected to Throat', 'No higher authority centers defined']
      };
    }
  }

  // 6. Mental / Environmental (no inner authority)
  return {
    value: 'Mental / Environmental',
    reason: [
      'No inner authority centers defined',
      'Relies on outer/environmental authority'
    ]
  };
}

// ─── Profile Determination ──────────────────────────────────────────────────

/**
 * Determine Profile from Personality Sun line and Design Sun line.
 */
function determineProfile(personalityActivations, designActivations) {
  const personalitySun = personalityActivations.find(a => a.planet === 'Sun');
  const designSun = designActivations.find(a => a.planet === 'Sun');

  if (!personalitySun || !designSun) {
    throw new Error('Cannot determine profile: Sun activation missing');
  }

  const profileKey = `${personalitySun.line}/${designSun.line}`;
  const profileName = PROFILE_NAMES[profileKey] || 'Unknown';

  return {
    value: profileKey,
    name: profileName,
    personality_sun_line: personalitySun.line,
    design_sun_line: designSun.line,
    reason: [
      `Personality Sun line = ${personalitySun.line} (Gate ${personalitySun.gate})`,
      `Design Sun line = ${designSun.line} (Gate ${designSun.gate})`
    ]
  };
}

// ─── Definition Determination ───────────────────────────────────────────────

/**
 * Determine Definition type using graph connectivity analysis.
 * Counts connected components among defined centers.
 */
function determineDefinition(centersInfo, activeChannels) {
  const defined = centersInfo.defined;

  if (defined.length === 0) {
    return {
      value: 'No Definition',
      components: 0,
      groups: [],
      reason: ['No centers defined (Reflector)']
    };
  }

  // Build adjacency graph
  const adj = {};
  for (const center of defined) {
    adj[center] = new Set();
  }

  for (const channel of activeChannels) {
    const [c1, c2] = channel.centers;
    if (adj[c1] && adj[c2]) {
      adj[c1].add(c2);
      adj[c2].add(c1);
    }
  }

  // Find connected components using BFS
  const visited = new Set();
  const components = [];

  for (const center of defined) {
    if (!visited.has(center)) {
      const component = [];
      const queue = [center];
      visited.add(center);

      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);

        if (adj[current]) {
          for (const neighbor of adj[current]) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }

      components.push(component);
    }
  }

  const definitionMap = {
    1: 'Single Definition',
    2: 'Split Definition',
    3: 'Triple Split Definition',
    4: 'Quadruple Split Definition'
  };

  const numComponents = components.length;
  const defValue = definitionMap[numComponents] || `${numComponents}-Split Definition`;

  return {
    value: defValue,
    components: numComponents,
    groups: components,
    reason: [
      `${defined.length} defined centers form ${numComponents} connected group(s)`,
      ...components.map((c, i) => `Group ${i + 1}: ${c.join(', ')}`)
    ]
  };
}

// ─── Incarnation Cross ──────────────────────────────────────────────────────

/**
 * Determine Incarnation Cross from the four key Sun/Earth activations.
 */
function determineIncarnationCross(personalityActivations, designActivations, profile) {
  const pSun = personalityActivations.find(a => a.planet === 'Sun');
  const pEarth = personalityActivations.find(a => a.planet === 'Earth');
  const dSun = designActivations.find(a => a.planet === 'Sun');
  const dEarth = designActivations.find(a => a.planet === 'Earth');

  if (!pSun || !pEarth || !dSun || !dEarth) {
    throw new Error('Cannot determine incarnation cross: Sun/Earth activations missing');
  }

  const crossType = PROFILE_TO_CROSS_TYPE[profile.value] || 'Unknown';

  return {
    type: crossType,
    gates: {
      personality_sun: pSun.gate,
      personality_earth: pEarth.gate,
      design_sun: dSun.gate,
      design_earth: dEarth.gate
    },
    label: `${crossType} Cross of ${pSun.gate}/${pEarth.gate} | ${dSun.gate}/${dEarth.gate}`,
    reason: [
      `Personality Sun: Gate ${pSun.gate}`,
      `Personality Earth: Gate ${pEarth.gate}`,
      `Design Sun: Gate ${dSun.gate}`,
      `Design Earth: Gate ${dEarth.gate}`,
      `Cross type: ${crossType} (from profile ${profile.value})`
    ]
  };
}

// ─── Full Chart Computation ─────────────────────────────────────────────────

/**
 * Compute the complete Human Design chart from astronomical positions.
 * This is the core Layer C engine.
 */
function computeChart(personalityPositions, designPositions) {
  // Step 1: Map longitudes to gates/lines
  const personalityActivations = buildActivations(personalityPositions, 'personality');
  const designActivations = buildActivations(designPositions, 'design');
  const allActivations = [...personalityActivations, ...designActivations];

  // Step 2: Determine channels
  const activeChannels = determineChannels(allActivations);

  // Step 3: Determine centers
  const centersInfo = determineDefinedCenters(activeChannels);

  // Step 4: Determine type
  const type = determineType(centersInfo, activeChannels);

  // Step 5: Determine authority
  const authority = determineAuthority(centersInfo, type.value, activeChannels);

  // Step 6: Determine profile
  const profile = determineProfile(personalityActivations, designActivations);

  // Step 7: Determine definition
  const definition = determineDefinition(centersInfo, activeChannels);

  // Step 8: Determine incarnation cross
  const incarnationCross = determineIncarnationCross(
    personalityActivations, designActivations, profile
  );

  return {
    personality_activations: personalityActivations,
    design_activations: designActivations,
    active_channels: activeChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      centers: ch.centers,
      gates: ch.gates
    })),
    centers: centersInfo,
    type,
    authority,
    profile,
    definition,
    incarnation_cross: incarnationCross
  };
}

module.exports = {
  longitudeToGateLine,
  buildActivations,
  determineChannels,
  determineDefinedCenters,
  determineType,
  hasMotorToThroatConnection,
  determineAuthority,
  determineProfile,
  determineDefinition,
  determineIncarnationCross,
  computeChart
};
