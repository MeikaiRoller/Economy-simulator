// Standalone PVP Battle Test - No Database Required
// Tests player vs player combat scenarios with various stat combinations

class Character {
  constructor(name, level, equipment) {
    this.name = name;
    this.level = level;
    this.equipment = equipment;
    
    // Calculate base stats from level
    this.maxHp = Math.floor(250 + level * 5);
    this.currentHp = this.maxHp;
    this.baseAttack = Math.floor(25 + level * 2);
    this.baseDefense = Math.floor(10 + level);
    
    // Apply equipment bonuses
    this.attackBonus = equipment.attack || 0;
    this.defenseBonus = equipment.defense || 0;
    this.hpBonus = equipment.hp || 0;
    this.critRate = equipment.critRate || 0;
    this.critDamage = equipment.critDamage || 100;
    this.dodgeChance = Math.min(equipment.dodge || 0, 50);
    
    this.totalHp = Math.floor(this.maxHp * (1 + this.hpBonus / 100));
    this.currentHp = this.totalHp;
    this.attack = Math.floor((this.baseAttack + this.attackBonus) * 1.15);
    this.defense = Math.floor((this.baseDefense + this.defenseBonus) * 1.1);
  }
  
  heal(amount) {
    this.currentHp = Math.min(this.currentHp + amount, this.totalHp);
  }
  
  takeDamage(damage) {
    // Check if dodge
    if (Math.random() * 100 < this.dodgeChance) {
      return { damage: 0, isDodge: true, isCrit: false };
    }
    
    // Apply defense
    let actualDamage = Math.max(damage - this.defense, Math.floor(damage * 0.1));
    
    // Check for critical hit
    let isCrit = false;
    if (Math.random() * 100 < this.critRate) {
      actualDamage = Math.floor(actualDamage * (this.critDamage / 100));
      isCrit = true;
    }
    
    this.currentHp -= actualDamage;
    return { damage: actualDamage, isDodge: false, isCrit };
  }
  
  isAlive() {
    return this.currentHp > 0;
  }
}

function simulateBattle(player1, player2, verbose = true) {
  if (verbose) {
    console.log("\n" + "=".repeat(60));
    console.log(`⚔️  BATTLE: ${player1.name} vs ${player2.name}`);
    console.log("=".repeat(60));
    console.log(`\n${player1.name} Stats:`);
    console.log(`  HP: ${player1.totalHp} | ATK: ${player1.attack} | DEF: ${player1.defense}`);
    console.log(`  Crit: ${player1.critRate}% | Dodge: ${player1.dodgeChance}%`);
    
    console.log(`\n${player2.name} Stats:`);
    console.log(`  HP: ${player2.totalHp} | ATK: ${player2.attack} | DEF: ${player2.defense}`);
    console.log(`  Crit: ${player2.critRate}% | Dodge: ${player2.dodgeChance}%`);
    console.log("\n" + "-".repeat(60));
  }
  
  let turn = 0;
  let turnLog = [];
  const maxTurns = 50;
  
  // Battle loop
  while (player1.isAlive() && player2.isAlive() && turn < maxTurns) {
    turn++;
    
    // Player 1 attacks
    const damage1 = player1.attack + Math.floor(Math.random() * 20 - 10);
    const result1 = player2.takeDamage(damage1);
    
    let action1 = `Turn ${turn}: ${player1.name}`;
    if (result1.isDodge) {
      action1 += ` attacks but ${player2.name} DODGES!`;
    } else if (result1.isCrit) {
      action1 += ` CRITICAL HIT! Deals ${result1.damage} damage`;
    } else {
      action1 += ` attacks for ${result1.damage} damage`;
    }
    turnLog.push(action1);
    
    if (!player2.isAlive()) break;
    
    // Player 2 attacks
    const damage2 = player2.attack + Math.floor(Math.random() * 20 - 10);
    const result2 = player1.takeDamage(damage2);
    
    let action2 = `         ${player2.name}`;
    if (result2.isDodge) {
      action2 += ` attacks but ${player1.name} DODGES!`;
    } else if (result2.isCrit) {
      action2 += ` CRITICAL HIT! Deals ${result2.damage} damage`;
    } else {
      action2 += ` attacks for ${result2.damage} damage`;
    }
    turnLog.push(action2);
    
    turnLog.push(`         ${player1.name}: ${Math.max(0, player1.currentHp)}/${player1.totalHp} HP | ${player2.name}: ${Math.max(0, player2.currentHp)}/${player2.totalHp} HP`);
  }
  
  if (verbose) {
    // Print last 10 turns
    const startIdx = Math.max(0, turnLog.length - 10);
    if (turnLog.length > 10) {
      console.log("\n[... previous turns ...]");
    }
    turnLog.slice(startIdx).forEach(log => console.log(log));
    
    console.log("\n" + "=".repeat(60));
    if (player1.isAlive()) {
      const survivedHp = player1.currentHp;
      const hpPercent = (survivedHp / player1.totalHp * 100).toFixed(1);
      console.log(`🏆 ${player1.name} WINS! (${survivedHp}/${player1.totalHp} HP - ${hpPercent}% health remaining)`);
      console.log(`   Turns taken: ${turn}`);
    } else {
      const survivedHp = player2.currentHp;
      const hpPercent = (survivedHp / player2.totalHp * 100).toFixed(1);
      console.log(`🏆 ${player2.name} WINS! (${survivedHp}/${player2.totalHp} HP - ${hpPercent}% health remaining)`);
      console.log(`   Turns taken: ${turn}`);
    }
    console.log("=".repeat(60));
  }
  
  return player1.isAlive() ? player1 : player2;
}

// Test Scenarios
console.log("\n🎮 PVP BATTLE TEST SUITE");
console.log("════════════════════════════════════════════════════════════\n");

// Scenario 1: Balanced Match
console.log("📊 TEST 1: Balanced Build vs Balanced Build");
const balanced1 = new Character("Knight", 25, {
  attack: 150,
  defense: 100,
  hp: 20,
  critRate: 15,
  critDamage: 150,
  dodge: 5
});

const balanced2 = new Character("Mage", 25, {
  attack: 180,
  defense: 70,
  hp: 10,
  critRate: 25,
  critDamage: 200,
  dodge: 10
});

balanced1.currentHp = balanced1.totalHp;
balanced2.currentHp = balanced2.totalHp;
simulateBattle(balanced1, balanced2);

// Scenario 2: Tank vs Glass Cannon
console.log("\n📊 TEST 2: Tank vs Glass Cannon");
const tank = new Character("Paladin", 25, {
  attack: 120,
  defense: 180,
  hp: 40,
  critRate: 5,
  critDamage: 100,
  dodge: 2
});

const glassCannon = new Character("Assassin", 25, {
  attack: 250,
  defense: 40,
  hp: 0,
  critRate: 40,
  critDamage: 250,
  dodge: 25
});

tank.currentHp = tank.totalHp;
glassCannon.currentHp = glassCannon.totalHp;
simulateBattle(tank, glassCannon);

// Scenario 3: Dodge vs Crit
console.log("\n📊 TEST 3: Evasion Build vs Critical Build");
const evasion = new Character("Ninja", 25, {
  attack: 140,
  defense: 60,
  hp: 5,
  critRate: 10,
  critDamage: 120,
  dodge: 40
});

const crit = new Character("Berserker", 25, {
  attack: 160,
  defense: 80,
  hp: 15,
  critRate: 50,
  critDamage: 300,
  dodge: 5
});

evasion.currentHp = evasion.totalHp;
crit.currentHp = crit.totalHp;
simulateBattle(evasion, crit);

// Scenario 4: Level Advantage
console.log("\n📊 TEST 4: Level 30 vs Level 20 (Same Build)");
const highLevel = new Character("Veteran", 30, {
  attack: 150,
  defense: 100,
  hp: 15,
  critRate: 20,
  critDamage: 150,
  dodge: 10
});

const lowLevel = new Character("Recruit", 20, {
  attack: 150,
  defense: 100,
  hp: 15,
  critRate: 20,
  critDamage: 150,
  dodge: 10
});

highLevel.currentHp = highLevel.totalHp;
lowLevel.currentHp = lowLevel.totalHp;
simulateBattle(highLevel, lowLevel);

// Scenario 5: Pure Defense vs Balanced
console.log("\n📊 TEST 5: Defense Stacking vs Balanced");
const defender = new Character("Fortress", 25, {
  attack: 100,
  defense: 220,
  hp: 30,
  critRate: 5,
  critDamage: 100,
  dodge: 0
});

const balanced3 = new Character("Warrior", 25, {
  attack: 160,
  defense: 120,
  hp: 20,
  critRate: 20,
  critDamage: 150,
  dodge: 10
});

defender.currentHp = defender.totalHp;
balanced3.currentHp = balanced3.totalHp;
simulateBattle(defender, balanced3);

// Statistics over multiple battles
console.log("\n📊 TEST 6: Statistics Over 100 Battles");
console.log("════════════════════════════════════════════════════════════\n");

const competitor1 = new Character("Phoenix", 25, {
  attack: 150,
  defense: 100,
  hp: 20,
  critRate: 20,
  critDamage: 150,
  dodge: 8
});

const competitor2 = new Character("Dragon", 25, {
  attack: 155,
  defense: 105,
  hp: 22,
  critRate: 18,
  critDamage: 160,
  dodge: 7
});

let p1Wins = 0;
let p2Wins = 0;
let totalTurns = 0;

for (let i = 0; i < 100; i++) {
  competitor1.currentHp = competitor1.totalHp;
  competitor2.currentHp = competitor2.totalHp;
  
  let winner = simulateBattle(competitor1, competitor2, false);
  if (winner === competitor1) {
    p1Wins++;
  } else {
    p2Wins++;
  }
}

console.log(`${competitor1.name}: ${p1Wins} wins (${(p1Wins).toFixed(1)}%)`);
console.log(`${competitor2.name}: ${p2Wins} wins (${(p2Wins).toFixed(1)}%)`);

console.log("\n════════════════════════════════════════════════════════════");
console.log("✅ All PVP Battle Tests Completed!");
console.log("════════════════════════════════════════════════════════════\n");
