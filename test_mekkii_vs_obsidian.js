// Test fight: obsidiangator vs mekkii_ (One-shot scenario)
// Based on actual player profiles showing Meki getting one-shot

class BattlePlayer {
  constructor(name, stats) {
    this.name = name;
    this.level = stats.level;
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.maxHp = stats.hp;
    this.currentHp = stats.hp;
    this.critRate = stats.critRate;
    this.critDMG = stats.critDMG;
    this.equipment = stats.equipment || [];
    this.elements = stats.elements || [];
  }

  isAlive() {
    return this.currentHp > 0;
  }

  takeDamage(damage) {
    this.currentHp -= damage;
    return this.currentHp;
  }

  getInfo() {
    return `${this.name} (Lv.${this.level}) | HP: ${this.maxHp} | ATK: ${this.attack} | DEF: ${this.defense} | Crit: ${this.critRate}% (${this.critDMG}% DMG)`;
  }
}

function calculateDamage(attacker, defender) {
  // Base damage calculation with variance
  const variance = 0.85 + Math.random() * 0.30; // 85-115% variance
  let baseDamage = attacker.attack * variance;

  // Defense reduction (League of Legends formula)
  const defenseReduction = defender.defense / (defender.defense + 100);
  let damage = Math.floor(baseDamage * (1 - defenseReduction));

  if (damage < 1) damage = 1;

  // Check for critical hit
  let isCrit = false;
  if (Math.random() * 100 < attacker.critRate) {
    isCrit = true;
    damage = Math.floor(damage * (attacker.critDMG / 100));
  }

  return { damage, isCrit };
}

function simulateBattle(player1, player2) {
  console.log("\n" + "═".repeat(80));
  console.log(`⚔️  DUEL: ${player1.name} vs ${player2.name}`);
  console.log("═".repeat(80));

  // Display stats
  console.log(`\n📊 STARTING STATS:\n`);
  console.log(`  🟦 ${player1.getInfo()}`);
  console.log(`  🟥 ${player2.getInfo()}`);

  if (player1.elements.length > 0) {
    console.log(`  Elements: ${player1.elements.join(" · ")}`);
  }
  if (player2.elements.length > 0) {
    console.log(`  Elements: ${player2.elements.join(" · ")}`);
  }

  console.log("\n" + "-".repeat(80));
  console.log("⚡ BATTLE START!\n");

  let turn = 0;
  const maxTurns = 50;
  let battleLog = [];

  // Determine who goes first (higher level goes first, or random)
  let currentAttacker = player1;
  let currentDefender = player2;
  let isPlayer1Turn = player1.level >= player2.level;

  while (player1.isAlive() && player2.isAlive() && turn < maxTurns) {
    turn++;

    // Switch turns
    if (isPlayer1Turn) {
      currentAttacker = player1;
      currentDefender = player2;
    } else {
      currentAttacker = player2;
      currentDefender = player1;
    }

    // Calculate damage
    const { damage, isCrit } = calculateDamage(currentAttacker, currentDefender);
    currentDefender.takeDamage(damage);

    // Log the attack
    const attackType = isCrit ? "💥 CRIT HIT" : "🔪 Attacks";
    const log = `Turn ${turn}: ${currentAttacker.name} ${attackType} → ${damage} damage! | ${currentDefender.name} HP: ${Math.max(0, currentDefender.currentHp)}/${currentDefender.maxHp}`;
    battleLog.push(log);
    console.log(log);

    // Check if battle is over
    if (!currentDefender.isAlive()) {
      break;
    }

    isPlayer1Turn = !isPlayer1Turn;
  }

  // Battle Results
  console.log("\n" + "═".repeat(80));
  if (player1.isAlive()) {
    console.log(`🏆 VICTORY: ${player1.name} wins the duel!`);
    console.log(
      `   Remaining HP: ${player1.currentHp}/${player1.maxHp} (${Math.round(
        (player1.currentHp / player1.maxHp) * 100
      )}%)`
    );
  } else {
    console.log(`🏆 VICTORY: ${player2.name} wins the duel!`);
    console.log(
      `   Remaining HP: ${player2.currentHp}/${player2.maxHp} (${Math.round(
        (player2.currentHp / player2.maxHp) * 100
      )}%)`
    );
  }
  console.log(`   Battle lasted ${turn} turn(s)`);
  console.log("═".repeat(80) + "\n");

  return player1.isAlive() ? player1 : player2;
}

// ============================================================
// PLAYER PROFILES (Based on Discord screenshots)
// ============================================================

const obsidiangator = new BattlePlayer("obsidiangator", {
  level: 71,
  hp: 2191,
  attack: 1455,
  defense: 754,
  critRate: 26,
  critDMG: 127,
  elements: ["🔥 Pyro", "⚡ Electro", "💧 Hydro"],
  equipment: [
    "🔥 Olivias Fury Weapon",
    "⚡ Justins Clapping Head",
    "💧 Andys Soraka Chest",
    "⚡ Justins Clapping Hands",
    "💧 Andys Soraka Feet",
    "🔥 Olivias Fury Accessory",
  ],
});

const mekkii = new BattlePlayer("mekkii_", {
  level: 66,
  hp: 1389,
  attack: 1234,
  defense: 670,
  critRate: 16,
  critDMG: 114,
  elements: ["🪨 Geo", "💨 Anemo", "🔥 Pyro"],
  equipment: [
    "🪨 Maries Zhongli Head (Geo)",
    "🪨 Maries Zhongli Chest (Geo)",
    "🪨 Maries Zhongli Hands (Geo)",
    "💨 Hasagi Feet (Anemo)",
    "🔥 Olivias Fury Accessory (Pyro)",
  ],
});

// ============================================================
// RUN BATTLES
// ============================================================

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      PVP BATTLE TEST SIMULATOR                               ║
║                  obsidiangator vs mekkii_ (One-Shot Test)                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

console.log("📋 ANALYSIS: Why did Meki get one-shot?");
console.log(`
  ⚖️  Stat Comparison:
     • HP Gap: ${obsidiangator.maxHp - mekkii.maxHp} HP difference (obsidiangator: ${obsidiangator.maxHp}, mekkii: ${mekkii.maxHp})
     • Attack Gap: ${obsidiangator.attack - mekkii.attack} ATK (obsidiangator: ${obsidiangator.attack}, mekkii: ${mekkii.attack})
     • Damage per turn potential: ${obsidiangator.attack * 0.85} - ${obsidiangator.attack * 1.15} damage
     • With Crit (26% chance): Up to ${Math.floor((obsidiangator.attack * 1.15 * (obsidiangator.critDMG / 100)) * 1.2)} damage
     
  🛡️  Defense Analysis:
     • Mekkii's defense: ${mekkii.defense}
     • Defense reduction: ${(mekkii.defense / (mekkii.defense + 100)).toFixed(2)} (${Math.round((mekkii.defense / (mekkii.defense + 100)) * 100)}%)
     • vs obsidiangator's attack
     
  🎯 Conclusion:
     Mekkii has 802 fewer HP and faces a ${obsidiangator.attack - mekkii.attack} attack disadvantage.
     A single critical hit from obsidiangator could easily exceed 1389 HP!
`);

// Run the battle multiple times to show variance
console.log("\n🔄 Running 5 battle simulations to show variance:\n");

for (let i = 1; i <= 5; i++) {
  console.log(`\n>>> Simulation ${i}:`);
  
  // Reset HP
  obsidiangator.currentHp = obsidiangator.maxHp;
  mekkii.currentHp = mekkii.maxHp;
  
  const winner = simulateBattle(obsidiangator, mekkii);
}

// One-shot probability calculation
console.log("\n📊 ONE-SHOT PROBABILITY ANALYSIS:");
const damageRange = {
  min: Math.floor(obsidiangator.attack * 0.85 * (1 - mekkii.defense / (mekkii.defense + 100))),
  max: Math.floor(obsidiangator.attack * 1.15 * (1 - mekkii.defense / (mekkii.defense + 100))),
};

const critDamageRange = {
  min: Math.floor(damageRange.min * (obsidiangator.critDMG / 100)),
  max: Math.floor(damageRange.max * (obsidiangator.critDMG / 100)),
};

console.log(`
  Regular Hit Range: ${damageRange.min} - ${damageRange.max} damage
  Critical Hit Range: ${critDamageRange.min} - ${critDamageRange.max} damage
  
  Mekkii's HP: ${mekkii.maxHp}
  
  ✅ ONE-SHOT POSSIBLE?
     • Non-crit: ${damageRange.max >= mekkii.maxHp ? "YES (max damage exceeds HP)" : "NO"}
     • Crit (26% chance): ${critDamageRange.max >= mekkii.maxHp ? "YES! (very likely)" : "NO"}
     
  🔥 Crit Chance: ${obsidiangator.critRate}% (1 in ${(100 / obsidiangator.critRate).toFixed(1)} hits)
  💥 One-shot chance per attack: ~${(obsidiangator.critRate / 100).toFixed(1)} (if crits always one-shot)
`);

console.log("═".repeat(80));
