/**
 * Generate horses for a race with odds, deterministic per raceHour.
 * @param {Date} raceHour - start of hour for the race; defaults to current hour
 */
function generateHorsesForRace(raceHour = new Date()) {
  const seed = new Date(raceHour).getTime();
  const rng = createSeededRng(seed);
  const horseNames = [
    "Thunder",
    "Lightning",
    "Blaze",
    "Storm",
    "Shadow",
    "Spirit",
    "Phoenix",
    "Tornado",
    "Meteor",
    "Comet",
    "Vortex",
    "Eclipse",
    "Nova",
    "Inferno",
    "Cyclone",
    "Avalanche",
    "Bolt",
    "Fury",
    "Velocity",
    "Titan",
  ];

  // Shuffle deterministically and pick 6 horses
  const shuffled = shuffleWithRng([...horseNames], rng);
  const selectedHorses = shuffled.slice(0, 6);

  // Assign odds: some common (1.5x-2x), some mid (3x-5x), some rare (8x-15x)
  const horsesWithOdds = selectedHorses.map((name, index) => {
    let odds;
    if (index < 2) {
      // Favorites (common)
      odds = 1.5 + rng() * 0.5; // 1.5x - 2x
    } else if (index < 4) {
      // Mid-tier
      odds = 3 + rng() * 2; // 3x - 5x
    } else {
      // Long shots (rare)
      odds = 8 + rng() * 7; // 8x - 15x
    }
    return {
      name,
      odds: parseFloat(odds.toFixed(2)),
      winProbability: 1 / odds, // Probability based on inverse of odds
    };
  });

  return horsesWithOdds;
}

// Deterministic RNG (mulberry32)
function createSeededRng(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = generateHorsesForRace;
