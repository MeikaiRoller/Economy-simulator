// Standalone PVP Battle Test - Item-Based System with Elemental Reactions
// Tests player vs player combat scenarios with actual game item mechanics

const { generateItem, SETS } = require('./utils/generateItem');
const { calculateSetBonuses } = require('./utils/setbonuses');

class TestPlayer {
  constructor(name, level, equipment) {
    this.name = name;
    this.level = level;
    this.equipment = equipment; // Array of item objects
    
    // Calculate buffs from equipment
    this.buffs = this.calculateBuffs();
    
    // Calculate base stats with buffs
    const baseAttack = 25 + (level * 2);
    const baseDefense = 12 + level;
    const baseHp = 250 + (level * 5);
    
    this.attack = Math.floor((baseAttack + this.buffs.attackFlat) * (1 + this.buffs.attack));
    // Cap defense at 500 to prevent extreme tankiness
    this.defense = Math.min(Math.floor((baseDefense + this.buffs.defenseFlat) * (1 + this.buffs.defense)), 500);
    this.maxHp = Math.floor((baseHp + this.buffs.hpFlat) * (1 + this.buffs.hpPercent));
    this.currentHp = this.maxHp;
    
    // Cap crit rate at 80%
    this.critRate = Math.min(5 + this.buffs.critChance, 80);
    this.critDamage = 100 + this.buffs.critDMG;
    this.luck = this.buffs.luck || 0;
    // Cap dodge at 35%, luck has minimal effect (+2% per point instead of +10%)
    this.dodge = Math.min(5 + (this.luck * 2) + (this.buffs.dodge || 0), 35);
    // Counter chance, luck has minimal effect (+1% per point instead of +5%)
    this.counter = Math.min(10 + (this.luck * 1), 40);
    
    this.damageBonus = 1 + (this.buffs.damageBonus || 0);
    this.lifesteal = this.buffs.lifesteal || 0;
    this.lifestealChance = this.buffs.lifestealChance || 0;
  }
  
  calculateBuffs() {
    const buffs = {
      attack: 0, defense: 0, hpPercent: 0,
      attackFlat: 0, defenseFlat: 0, hpFlat: 0,
      critChance: 0, critDMG: 0, energy: 0,
      dodge: 0, luck: 0, damageBonus: 0,
      lifesteal: 0, lifestealChance: 0,
      setInfo: null
    };
    
    // Calculate set bonuses
    const setBonusData = calculateSetBonuses(this.equipment);
    buffs.setInfo = setBonusData;
    
    // Add buffs from individual items
    for (const item of this.equipment) {
      // Main stat
      if (item.mainStat?.type && item.mainStat?.value) {
        const statType = item.mainStat.type;
        const value = item.mainStat.value;
        
        if (statType === 'attack') buffs.attackFlat += value;
        else if (statType === 'defense') buffs.defenseFlat += value;
        else if (statType === 'hp') buffs.hpFlat += value;
        else if (statType === 'critRate') buffs.critChance += value;
        else if (statType === 'critDMG') buffs.critDMG += value;
        else if (statType === 'energy') buffs.energy += value;
      }
      
      // Sub-stats
      if (item.subStats?.length) {
        for (const subStat of item.subStats) {
          const statType = subStat.type;
          const value = subStat.value;
          
          if (statType === 'attack') buffs.attackFlat += value;
          else if (statType === 'attack%') buffs.attack += value / 100;
          else if (statType === 'defense') buffs.defenseFlat += value;
          else if (statType === 'defense%') buffs.defense += value / 100;
          else if (statType === 'hp') buffs.hpFlat += value;
          else if (statType === 'hp%') buffs.hpPercent += value / 100;
          else if (statType === 'critRate') buffs.critChance += value;
          else if (statType === 'critDMG') buffs.critDMG += value;
          else if (statType === 'energy') buffs.energy += value;
          else if (statType === 'luck') buffs.luck += value;
        }
      }
    }
    
    // Apply set bonuses
    const setBonuses = setBonusData.bonuses;
    buffs.attack += setBonuses.attack || 0;
    buffs.defense += setBonuses.defense || 0;
    buffs.hpPercent += setBonuses.hp || 0;
    buffs.critChance += setBonuses.critRate || 0;
    buffs.critDMG += setBonuses.critDMG || 0;
    buffs.energy += setBonuses.energy || 0;
    buffs.dodge += setBonuses.dodge || 0;
    buffs.damageBonus += setBonuses.damageBonus || 0;
    buffs.lifesteal += setBonuses.lifesteal || 0;
    buffs.lifestealChance += setBonuses.lifestealChance || 0;
    
    return buffs;
  }
  
  isAlive() {
    return this.currentHp > 0;
  }
}

function simulateBattle(player1, player2, verbose = true) {
  if (verbose) {
    console.log("\n" + "=".repeat(70));
    console.log(`⚔️  BATTLE: ${player1.name} vs ${player2.name}`);
    console.log("=".repeat(70));
    
    // Display player 1 info
    console.log(`\n${player1.name} (Lv.${player1.level}) Stats:`);
    console.log(`  HP: ${player1.maxHp} | ATK: ${player1.attack} | DEF: ${player1.defense}`);
    console.log(`  Crit: ${player1.critRate.toFixed(1)}% (${player1.critDamage}% DMG) | Dodge: ${player1.dodge.toFixed(1)}%`);
    console.log(`  Luck: ${player1.luck.toFixed(2)} | Damage Bonus: +${(player1.damageBonus * 100 - 100).toFixed(1)}%`);
    
    // Display set bonuses
    if (player1.buffs.setInfo.activeSetBonuses.length > 0) {
      console.log(`  📦 Sets: ${player1.buffs.setInfo.activeSetBonuses.join(', ')}`);
    }
    if (player1.buffs.setInfo.elementalResonance) {
      console.log(`  ✨ ${player1.buffs.setInfo.elementalResonance.name}`);
    }
    if (player1.buffs.setInfo.dualMastery) {
      console.log(`  🔥⚡ DUAL MASTERY: ${player1.buffs.setInfo.dualMastery.name}`);
    }
    if (player1.buffs.setInfo.adaptiveBonus) {
      console.log(`  ⚡ ADAPTIVE: ${player1.buffs.setInfo.adaptiveBonus.triggers.join(', ')}`);
    }
    if (player1.buffs.setInfo.elementalReaction) {
      console.log(`  💥 ${player1.buffs.setInfo.elementalReaction.name}: ${player1.buffs.setInfo.elementalReaction.effect}`);
    }
    
    // Display player 2 info
    console.log(`\n${player2.name} (Lv.${player2.level}) Stats:`);
    console.log(`  HP: ${player2.maxHp} | ATK: ${player2.attack} | DEF: ${player2.defense}`);
    console.log(`  Crit: ${player2.critRate.toFixed(1)}% (${player2.critDamage}% DMG) | Dodge: ${player2.dodge.toFixed(1)}%`);
    console.log(`  Luck: ${player2.luck.toFixed(2)} | Damage Bonus: +${(player2.damageBonus * 100 - 100).toFixed(1)}%`);
    
    if (player2.buffs.setInfo.activeSetBonuses.length > 0) {
      console.log(`  📦 Sets: ${player2.buffs.setInfo.activeSetBonuses.join(', ')}`);
    }
    if (player2.buffs.setInfo.elementalResonance) {
      console.log(`  ✨ ${player2.buffs.setInfo.elementalResonance.name}`);
    }
    if (player2.buffs.setInfo.dualMastery) {
      console.log(`  🔥⚡ DUAL MASTERY: ${player2.buffs.setInfo.dualMastery.name}`);
    }
    if (player2.buffs.setInfo.adaptiveBonus) {
      console.log(`  ⚡ ADAPTIVE: ${player2.buffs.setInfo.adaptiveBonus.triggers.join(', ')}`);
    }
    if (player2.buffs.setInfo.elementalReaction) {
      console.log(`  💥 ${player2.buffs.setInfo.elementalReaction.name}: ${player2.buffs.setInfo.elementalReaction.effect}`);
    }
    
    console.log("\n" + "-".repeat(70));
  }
  
  let turn = 0;
  let turnLog = [];
  const maxTurns = 50;
  let p1Stunned = false;
  let p2Stunned = false;
  
  // Element reaction state tracking
  let p1SuperconductTurns = 0; // Tracks defense reduction
  let p2SuperconductTurns = 0;
  
  // Get element reactions
  const p1Reaction = player1.buffs.setInfo.elementalReaction;
  const p2Reaction = player2.buffs.setInfo.elementalReaction;
  
  // Battle loop
  while (player1.isAlive() && player2.isAlive() && turn < maxTurns) {
    turn++;
    
    // Player 1's turn
    if (!p1Stunned) {
      // Check dodge (reduced by Cryo Swirl if applicable)
      let p2DodgeChance = player2.dodge;
      if (p1Reaction?.dodgeReduction) {
        p2DodgeChance = Math.max(0, p2DodgeChance - (p1Reaction.dodgeReduction * 100));
      }
      
      if (Math.random() * 100 < p2DodgeChance) {
        turnLog.push(`Turn ${turn}: ${player1.name} attacks but ${player2.name} DODGES!`);
      } else {
        // Calculate damage with variance
        const variance = 0.8 + (Math.random() * 0.4);
        
        // Apply League of Legends armor formula: Damage Reduction = Armor / (Armor + 100)
        let effectiveDefense = player2.defense;
        if (p1SuperconductTurns > 0) {
          effectiveDefense = Math.floor(effectiveDefense * 0.7); // 30% defense reduction
          p1SuperconductTurns--;
        }
        const damageReduction = effectiveDefense / (effectiveDefense + 100);
        let damage = Math.floor(player1.attack * variance * player1.damageBonus * (1 - damageReduction));
        if (damage < 1) damage = 1;
        
        // Check crit
        let isCrit = Math.random() * 100 < player1.critRate;
        if (isCrit) damage = Math.floor(damage * (player1.critDamage / 100));
        
        // Apply element reactions
        let reactionProcs = [];
        if (p1Reaction && Math.random() < p1Reaction.procChance) {
          // Vaporize/Melt - damage multiplier
          if (p1Reaction.damageMultiplier) {
            damage = Math.floor(damage * p1Reaction.damageMultiplier);
            reactionProcs.push(`⚡${p1Reaction.name.toUpperCase()}`);
          }
          // Overload - bonus damage
          if (p1Reaction.bonusDamage) {
            damage += p1Reaction.bonusDamage;
            reactionProcs.push(`💥${p1Reaction.name.toUpperCase()}`);
          }
          // Freeze/Overload - stun chance
          if (p1Reaction.stunChance && Math.random() < p1Reaction.stunChance) {
            p2Stunned = true;
            reactionProcs.push(`❄️FROZEN`);
          }
          // Superconduct - defense reduction
          if (p1Reaction.defenseReduction) {
            p1SuperconductTurns = p1Reaction.duration || 3;
            reactionProcs.push(`⚡SUPERCONDUCT`);
          }
        }
        
        // Special procs
        let procs = [...reactionProcs];
        
        // Crushing blow (15% + luck*1) - minimal luck impact
        if (Math.random() * 100 < (15 + player1.luck * 1)) {
          damage += Math.floor(player2.defense * 0.5);
          procs.push("💥 CRUSH");
        }
        
        // Lifesteal (10% + luck*0.5 or lifestealChance) - minimal luck impact
        const lifestealProc = Math.random() * 100 < Math.max(10 + player1.luck * 0.5, player1.lifestealChance * 100);
        if (lifestealProc) {
          const heal = Math.floor(damage * (0.3 + player1.lifesteal));
          player1.currentHp = Math.min(player1.currentHp + heal, player1.maxHp);
          procs.push(`💚 LIFESTEAL(+${heal})`);
        }
        
        // Stun (5% + luck*0.5) - minimal luck impact
        if (Math.random() * 100 < (5 + player1.luck * 0.5)) {
          p2Stunned = true;
          procs.push("💫 STUN");
        }
        
        player2.currentHp -= damage;
        
        // Reflect damage (Swirl reactions)
        if (p2Reaction?.reflectDamage && Math.random() < (p2Reaction.procChance || 0.15)) {
          const reflectDmg = Math.floor(damage * p2Reaction.reflectDamage);
          player1.currentHp -= reflectDmg;
          procs.push(`🔄REFLECT(${reflectDmg})`);
          
          // Hydro Swirl heal
          if (p2Reaction.healPercent) {
            const heal = Math.floor(damage * p2Reaction.healPercent);
            player2.currentHp = Math.min(player2.currentHp + heal, player2.maxHp);
            procs.push(`💚HEAL(+${heal})`);
          }
        }
        
        const procText = procs.length > 0 ? ` [${procs.join(", ")}]` : "";
        turnLog.push(`Turn ${turn}: ${player1.name} ${isCrit ? "CRITS" : "attacks"} for ${damage} damage${procText}`);
        
        // Counter-attack
        if (player2.isAlive() && Math.random() * 100 < player2.counter) {
          let counterDmg = Math.floor((player2.attack - player1.defense) * 0.5);
          if (counterDmg < 3) counterDmg = 3;
          player1.currentHp -= counterDmg;
          turnLog.push(`         ${player2.name} counters for ${counterDmg} damage!`);
        }
      }
    } else {
      turnLog.push(`Turn ${turn}: ${player1.name} is STUNNED!`);
      p1Stunned = false;
    }
    
    if (!player2.isAlive()) break;
    
    // Player 2's turn
    if (!p2Stunned) {
      // Check dodge (reduced by Cryo Swirl if applicable)
      let p1DodgeChance = player1.dodge;
      if (p2Reaction?.dodgeReduction) {
        p1DodgeChance = Math.max(0, p1DodgeChance - (p2Reaction.dodgeReduction * 100));
      }
      
      if (Math.random() * 100 < p1DodgeChance) {
        turnLog.push(`         ${player2.name} attacks but ${player1.name} DODGES!`);
      } else {
        // Calculate damage with variance
        const variance = 0.8 + (Math.random() * 0.4);
        
        // Apply League of Legends armor formula
        let effectiveDefense = player1.defense;
        if (p2SuperconductTurns > 0) {
          effectiveDefense = Math.floor(effectiveDefense * 0.7);
          p2SuperconductTurns--;
        }
        const damageReduction = effectiveDefense / (effectiveDefense + 100);
        let damage = Math.floor(player2.attack * variance * player2.damageBonus * (1 - damageReduction));
        if (damage < 1) damage = 1;
        
        // Check crit
        let isCrit = Math.random() * 100 < player2.critRate;
        if (isCrit) damage = Math.floor(damage * (player2.critDamage / 100));
        
        // Apply element reactions
        let reactionProcs = [];
        if (p2Reaction && Math.random() < p2Reaction.procChance) {
          // Vaporize/Melt - damage multiplier
          if (p2Reaction.damageMultiplier) {
            damage = Math.floor(damage * p2Reaction.damageMultiplier);
            reactionProcs.push(`⚡${p2Reaction.name.toUpperCase()}`);
          }
          // Overload - bonus damage
          if (p2Reaction.bonusDamage) {
            damage += p2Reaction.bonusDamage;
            reactionProcs.push(`💥${p2Reaction.name.toUpperCase()}`);
          }
          // Freeze/Overload - stun chance
          if (p2Reaction.stunChance && Math.random() < p2Reaction.stunChance) {
            p1Stunned = true;
            reactionProcs.push(`❄️FROZEN`);
          }
          // Superconduct - defense reduction
          if (p2Reaction.defenseReduction) {
            p2SuperconductTurns = p2Reaction.duration || 3;
            reactionProcs.push(`⚡SUPERCONDUCT`);
          }
        }
        
        // Special procs
        let procs = [...reactionProcs];
        
        // Crushing blow (15% + luck*1) - minimal luck impact
        if (Math.random() * 100 < (15 + player2.luck * 1)) {
          damage += Math.floor(player1.defense * 0.5);
          procs.push("💥 CRUSH");
        }
        
        // Lifesteal (10% + luck*0.5 or lifestealChance) - minimal luck impact
        const lifestealProc = Math.random() * 100 < Math.max(10 + player2.luck * 0.5, player2.lifestealChance * 100);
        if (lifestealProc) {
          const heal = Math.floor(damage * (0.3 + player2.lifesteal));
          player2.currentHp = Math.min(player2.currentHp + heal, player2.maxHp);
          procs.push(`💚 LIFESTEAL(+${heal})`);
        }
        
        // Stun (5% + luck*0.5) - minimal luck impact
        if (Math.random() * 100 < (5 + player2.luck * 0.5)) {
          p1Stunned = true;
          procs.push("💫 STUN");
        }
        
        player1.currentHp -= damage;
        
        // Reflect damage (Swirl reactions)
        if (p1Reaction?.reflectDamage && Math.random() < (p1Reaction.procChance || 0.15)) {
          const reflectDmg = Math.floor(damage * p1Reaction.reflectDamage);
          player2.currentHp -= reflectDmg;
          procs.push(`🔄REFLECT(${reflectDmg})`);
          
          // Hydro Swirl heal
          if (p1Reaction.healPercent) {
            const heal = Math.floor(damage * p1Reaction.healPercent);
            player1.currentHp = Math.min(player1.currentHp + heal, player1.maxHp);
            procs.push(`💚HEAL(+${heal})`);
          }
        }
        
        const procText = procs.length > 0 ? ` [${procs.join(", ")}]` : "";
        turnLog.push(`         ${player2.name} ${isCrit ? "CRITS" : "attacks"} for ${damage} damage${procText}`);
        
        // Counter-attack
        if (player1.isAlive() && Math.random() * 100 < player1.counter) {
          let counterDmg = Math.floor((player1.attack - player2.defense) * 0.5);
          if (counterDmg < 3) counterDmg = 3;
          player2.currentHp -= counterDmg;
          turnLog.push(`         ${player1.name} counters for ${counterDmg} damage!`);
        }
      }
    } else {
      turnLog.push(`         ${player2.name} is STUNNED!`);
      p2Stunned = false;
    }
    
    turnLog.push(`         ${player1.name}: ${Math.max(0, player1.currentHp)}/${player1.maxHp} HP | ${player2.name}: ${Math.max(0, player2.currentHp)}/${player2.maxHp} HP`);
  }
  
  if (verbose) {
    // Print last 30 turns
    const startIdx = Math.max(0, turnLog.length - 30);
    if (turnLog.length > 30) {
      console.log("\n[... showing last 30 turns ...]");
    }
    turnLog.slice(startIdx).forEach(log => console.log(log));
    
    console.log("\n" + "=".repeat(70));
    if (player1.isAlive()) {
      const survivedHp = player1.currentHp;
      const hpPercent = (survivedHp / player1.maxHp * 100).toFixed(1);
      console.log(`🏆 ${player1.name} WINS! (${survivedHp}/${player1.maxHp} HP - ${hpPercent}% remaining)`);
      console.log(`   Turns taken: ${turn}`);
    } else {
      const survivedHp = player2.currentHp;
      const hpPercent = (survivedHp / player2.maxHp * 100).toFixed(1);
      console.log(`🏆 ${player2.name} WINS! (${survivedHp}/${player2.maxHp} HP - ${hpPercent}% remaining)`);
      console.log(`   Turns taken: ${turn}`);
    }
    console.log("=".repeat(70));
  }
  
  return player1.isAlive() ? player1 : player2;
}

// Helper function to generate a full set of equipment
function generateFullSet(setName, rarity, slots = ["weapon", "head", "chest", "hands", "feet", "accessory"]) {
  return slots.map(slot => generateItem(slot, rarity, setName));
}

// Helper function to generate mixed set (3+3)
function generateMixedSet(set1, set2, rarity1, rarity2) {
  const slots = ["weapon", "head", "chest", "hands", "feet", "accessory"];
  const equipment = [];
  
  for (let i = 0; i < 3; i++) {
    equipment.push(generateItem(slots[i], rarity1, set1));
  }
  for (let i = 3; i < 6; i++) {
    equipment.push(generateItem(slots[i], rarity2, set2));
  }
  
  return equipment;
}

// Test Scenarios
console.log("\n🎮 PVP BATTLE TEST SUITE - ITEM-BASED SYSTEM");
console.log("══════════════════════════════════════════════════════════════════════\n");

// Scenario 1: Full 6-Piece Pyro Set (Olivias Fury) vs Full 6-Piece Cryo Set (Lilahs Cold Heart)
console.log("📊 TEST 1: Full Pyro Set vs Full Cryo Set (Element Resonance Test)");
const pyroPlayer = new TestPlayer(
  "Pyro Knight",
  25,
  generateFullSet("Olivias Fury", "Epic")
);

const cryoPlayer = new TestPlayer(
  "Cryo Mage",
  25,
  generateFullSet("Lilahs Cold Heart", "Epic")
);

simulateBattle(pyroPlayer, cryoPlayer);

// Scenario 2: Full Electro Set vs Full Hydro Set
console.log("\n📊 TEST 2: Full Electro Set vs Full Hydro Set");
const electroPlayer = new TestPlayer(
  "Thunder God",
  25,
  generateFullSet("Justins Clapping", "Epic")
);

const hydroPlayer = new TestPlayer(
  "Water Healer",
  25,
  generateFullSet("Andys Soraka", "Epic")
);

simulateBattle(electroPlayer, hydroPlayer);

// Scenario 3: 3+3 Pyro+Hydro (Vaporize Reaction)
console.log("\n📊 TEST 3: Pyro+Hydro Dual Element (Vaporize Reaction)");
const vaporizePlayer = new TestPlayer(
  "Vaporizer",
  25,
  generateMixedSet("Olivias Fury", "Andys Soraka", "Rare", "Rare")
);

const geoPlayer = new TestPlayer(
  "Geo Tank",
  25,
  generateFullSet("Maries Zhongli Bodypillow", "Rare")
);

simulateBattle(vaporizePlayer, geoPlayer);

// Scenario 4: 3+3 Pyro+Electro (Overload Reaction)
console.log("\n📊 TEST 4: Pyro+Electro Dual Element (Overload Reaction)");
const overloadPlayer = new TestPlayer(
  "Overloader",
  25,
  generateMixedSet("Olivias Fury", "Justins Clapping", "Epic", "Epic")
);

const anemoPlayer = new TestPlayer(
  "Wind Dancer",
  25,
  generateFullSet("Hasagi", "Epic")
);

simulateBattle(overloadPlayer, anemoPlayer);

// Scenario 5: 3+3 Hydro+Cryo (Freeze Reaction)
console.log("\n📊 TEST 5: Hydro+Cryo Dual Element (Freeze Reaction)");
const freezePlayer = new TestPlayer(
  "Freeze Master",
  25,
  generateMixedSet("Andys Soraka", "Lilahs Cold Heart", "Epic", "Epic")
);

const neutralPlayer = new TestPlayer(
  "Balanced Warrior",
  25,
  generateFullSet("Ethans Prowess", "Epic")
);

simulateBattle(freezePlayer, neutralPlayer);

// Scenario 6: 3+3 Electro+Cryo (Superconduct Reaction)
console.log("\n📊 TEST 6: Electro+Cryo Dual Element (Superconduct Reaction)");
const superconductPlayer = new TestPlayer(
  "Superconductor",
  25,
  generateMixedSet("Justins Clapping", "Lilahs Cold Heart", "Rare", "Rare")
);

const balanced2 = new TestPlayer(
  "Knight Errant",
  25,
  generateFullSet("Ethans Prowess", "Rare")
);

simulateBattle(superconductPlayer, balanced2);

// Scenario 7: Anemo Swirl Reactions - 3+3 Anemo+Pyro
console.log("\n📊 TEST 7: Anemo+Pyro Dual Element (Pyro Swirl Reaction)");
const pyroSwirlPlayer = new TestPlayer(
  "Pyro Swirler",
  25,
  generateMixedSet("Hasagi", "Olivias Fury", "Epic", "Epic")
);

const tank2 = new TestPlayer(
  "Geo Guardian",
  25,
  generateFullSet("Maries Zhongli Bodypillow", "Epic")
);

simulateBattle(pyroSwirlPlayer, tank2);

// Scenario 8: Legendary vs Epic - Quality Test
console.log("\n📊 TEST 8: Legendary Equipment vs Epic Equipment");
const legendaryPlayer = new TestPlayer(
  "Legendary Hero",
  25,
  generateFullSet("Lilahs Cold Heart", "Legendary")
);

const epicPlayer = new TestPlayer(
  "Epic Warrior",
  25,
  generateFullSet("Lilahs Cold Heart", "Epic")
);

simulateBattle(legendaryPlayer, epicPlayer);

// Scenario 9: Level Difference (30 vs 20) with same sets
console.log("\n📊 TEST 9: Level 30 vs Level 20 (Same Equipment Quality)");
const highLevel = new TestPlayer(
  "Veteran",
  30,
  generateFullSet("Olivias Fury", "Rare")
);

const lowLevel = new TestPlayer(
  "Novice",
  20,
  generateFullSet("Olivias Fury", "Rare")
);

simulateBattle(highLevel, lowLevel);

// Scenario 10: Pyro+Cryo (Melt Reaction) - The strongest reaction
console.log("\n📊 TEST 10: Pyro+Cryo Dual Element (Melt Reaction - 2x Damage!)");
const meltPlayer = new TestPlayer(
  "Melt Master",
  25,
  generateMixedSet("Olivias Fury", "Lilahs Cold Heart", "Legendary", "Legendary")
);

const geoLegend = new TestPlayer(
  "Geo Legend",
  25,
  generateFullSet("Maries Zhongli Bodypillow", "Legendary")
);

simulateBattle(meltPlayer, geoLegend);

// Statistics over multiple battles
console.log("\n📊 TEST 11: Win Rate Analysis Over 50 Battles");
console.log("══════════════════════════════════════════════════════════════════════\n");
console.log("Testing: 3pc Pyro + 3pc Electro (Overload) vs Full 6pc Cryo (Resonance)\n");

let p1Wins = 0;
let p2Wins = 0;

for (let i = 0; i < 50; i++) {
  const competitor1 = new TestPlayer(
    "Overload",
    25,
    generateMixedSet("Olivias Fury", "Justins Clapping", "Epic", "Epic")
  );
  
  const competitor2 = new TestPlayer(
    "Cryo",
    25,
    generateFullSet("Lilahs Cold Heart", "Epic")
  );
  
  let winner = simulateBattle(competitor1, competitor2, false);
  if (winner === competitor1) {
    p1Wins++;
  } else {
    p2Wins++;
  }
}

console.log(`Overload (3+3): ${p1Wins} wins (${(p1Wins * 2).toFixed(1)}%)`);
console.log(`Cryo (6pc): ${p2Wins} wins (${(p2Wins * 2).toFixed(1)}%)`);

// RNG Substat Quality Test
console.log("\n📊 TEST 12: Substat Quality Impact (Good RNG vs Bad RNG)");
console.log("══════════════════════════════════════════════════════════════════════\n");
console.log("Testing: Same sets and level, but different substat quality\n");

let goodRNGWins = 0;
let badRNGWins = 0;

for (let i = 0; i < 50; i++) {
  // Good RNG - rolls high on substats
  const goodRNG = new TestPlayer(
    "GoodRNG",
    25,
    generateFullSet("Lilahs Cold Heart", "Epic")
  );
  
  // Simulate "bad RNG" by replacing with Common quality (same set, worse substats)
  const badRNG = new TestPlayer(
    "BadRNG",
    25,
    generateFullSet("Lilahs Cold Heart", "Common")
  );
  
  let winner = simulateBattle(goodRNG, badRNG, false);
  if (winner === goodRNG) {
    goodRNGWins++;
  } else {
    badRNGWins++;
  }
}

console.log(`Epic Quality (Good Substats): ${goodRNGWins} wins (${(goodRNGWins * 2).toFixed(1)}%)`);
console.log(`Common Quality (Bad Substats): ${badRNGWins} wins (${(badRNGWins * 2).toFixed(1)}%)`);

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("✅ All PVP Battle Tests Completed!");
console.log("══════════════════════════════════════════════════════════════════════\n");

