const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const RaidBoss = require('./schema/RaidBoss');
const calculateActiveBuffs = require('./utils/calculateBuffs');
require('dotenv').config();

async function testRaidBattle() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Get a random player or first player
    const players = await UserProfile.find({}).limit(1);
    
    if (players.length === 0) {
      console.log('❌ No players found!');
      await mongoose.connection.close();
      return;
    }

    const player = players[0];

    // Generate next boss stats instead of loading current
    const nextBossStats = await calculateBossStats();
    const raidBoss = {
      bossName: "Le Gromp",
      bossDescription: "An ancient amphibian guardian that grows stronger with each challenger",
      currentHp: nextBossStats.maxHp,
      maxHp: nextBossStats.maxHp,
      level: nextBossStats.level,
      attack: nextBossStats.attack,
      defense: nextBossStats.defense
    };

    console.log('\n' + '='.repeat(80));
    console.log('🐉 RAID BATTLE TEST - NEXT CYCLE BOSS');
    console.log('='.repeat(80));
    console.log(`\n👤 Player: ${player.userId}`);
    console.log(`   Level: ${player.level}`);
    console.log(`   Balance: $${player.balance.toLocaleString()}`);

    const buffs = await calculateActiveBuffs(player);
    const playerAttack = Math.floor((25 + player.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
    const playerDefense = Math.floor((12 + player.level + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
    const playerHp = Math.floor((250 + player.level * 15 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));

    console.log(`   Attack: ${playerAttack}`);
    console.log(`   Defense: ${playerDefense}`);
    console.log(`   HP: ${playerHp}`);

    console.log(`\n🐉 ${raidBoss.bossName}:`);
    console.log(`   Level: ${raidBoss.level}`);
    console.log(`   Attack: ${raidBoss.attack}`);
    console.log(`   Defense: ${raidBoss.defense}`);
    console.log(`   HP: ${raidBoss.currentHp} / ${raidBoss.maxHp}`);
    console.log(`   (Target: Kill avg player in ~${nextBossStats.targetTurnsToKill} turns)`);
    console.log(`   (Needs ${nextBossStats.bossAttackNeeded.toFixed(0)} dmg/turn to avg player HP of ${nextBossStats.avgPlayerHp.toFixed(0)})`)

    // Simulate battle
    const battleResult = await simulateRaidBattle(player, raidBoss, { username: player.userId, id: player.userId });

    console.log('\n' + '='.repeat(80));
    console.log('⚔️ BATTLE LOG');
    console.log('='.repeat(80));
    console.log('\n' + battleResult.combatLog);

    console.log('\n' + '='.repeat(80));
    console.log('📊 BATTLE RESULTS');
    console.log('='.repeat(80));
    console.log(`\n   Total Player Damage: ${battleResult.totalPlayerDamage.toLocaleString()}`);
    console.log(`   Player Defeated: ${battleResult.playerDefeated ? '❌ YES' : '✅ NO'}`);
    console.log(`   Boss Defeated: ${battleResult.bossDefeated ? '🎉 YES' : '❌ NO'}`);

    if (battleResult.bossDefeated) {
      console.log(`\n   🏆 VICTORY! You would earn rewards!`);
    } else if (battleResult.playerDefeated) {
      console.log(`\n   💀 DEFEAT! You would earn partial rewards.`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Test Complete\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function simulateRaidBattle(playerProfile, raidBoss, playerUser) {
  // Get player stats
  const playerBuffs = await calculateActiveBuffs(playerProfile);
  const playerAttack = Math.floor((25 + playerProfile.level * 2 + (playerBuffs.attackFlat || 0)) * (1 + playerBuffs.attack));
  const playerDefense = Math.floor((12 + playerProfile.level + (playerBuffs.defenseFlat || 0)) * (1 + playerBuffs.defense));
  const playerCrit = 5 + (playerBuffs.critChance || 0);
  const playerCritDMG = 100 + (playerBuffs.critDMG || 0);
  const playerLuck = playerBuffs.luck || 0;
  let playerHp = Math.floor((250 + playerProfile.level * 15 + (playerBuffs.hpFlat || 0)) * (1 + (playerBuffs.hpPercent || 0)));
  const maxPlayerHp = playerHp;

  // Boss stats
  let bossHp = raidBoss.currentHp;
  const maxBossHp = raidBoss.maxHp;
  const bossDodge = Math.min(5 + (playerLuck * 10), 30);
  
  let totalPlayerDamage = 0;
  let turn = 0;
  const maxTurns = 100;
  let combatLog = "";

  while (playerHp > 0 && bossHp > 0 && turn < maxTurns) {
    turn++;

    // PLAYER'S TURN
    if (Math.random() * 100 < bossDodge) {
      combatLog += `T${turn}: 💨 **${raidBoss.bossName}** dodges!\n`;
    } else {
      const variance = 0.8 + (Math.random() * 0.4);
      const damageReduction = raidBoss.defense / (raidBoss.defense + 100);
      let damage = Math.floor(playerAttack * (1 - damageReduction) * variance);
      if (damage < 1) damage = 1;

      const isCrit = Math.random() * 100 < playerCrit;
      if (isCrit) {
        damage = Math.floor(damage * (1 + playerCritDMG / 100));
      }

      let procMessages = [];
      if (Math.random() * 100 < (15 + playerLuck * 5)) {
        const bonusDamage = Math.floor(raidBoss.defense * 0.5 * variance);
        damage += bonusDamage;
        procMessages.push("💥 CRUSHING BLOW");
      }

      if (Math.random() * 100 < (10 + playerLuck * 3)) {
        const heal = Math.floor(damage * 0.3);
        playerHp = Math.min(playerHp + heal, maxPlayerHp);
        procMessages.push(`💚 LIFESTEAL (+${heal})`);
      }

      bossHp -= damage;
      totalPlayerDamage += damage;

      const procText = procMessages.length > 0 ? ` [${procMessages.join(", ")}]` : "";
      combatLog += `T${turn}: ⚔️ **${playerUser.username}** attacks for **${damage}**${isCrit ? " (CRIT!)" : ""}${procText}\n`;
    }

    if (bossHp <= 0) break;

    // BOSS'S TURN
    const playerDodge = Math.min(5 + (playerLuck * 10), 30);
    if (Math.random() * 100 < playerDodge) {
      combatLog += `T${turn}: 💨 **${playerUser.username}** dodges!\n`;
    } else {
      const variance = 0.8 + (Math.random() * 0.4);
      const bossDamageReduction = playerDefense / (playerDefense + 100);
      let bossDamage = Math.floor(raidBoss.attack * (1 - bossDamageReduction) * variance);
      if (bossDamage < 1) bossDamage = 1;

      if (Math.random() * 100 < 10) {
        bossDamage = Math.floor(bossDamage * 1.5);
      }

      playerHp -= bossDamage;
      combatLog += `T${turn}: 🔥 **${raidBoss.bossName}** attacks for **${bossDamage}**!\n`;
    }

    if (turn % 10 === 0) combatLog += "\n";
  }

  const playerDefeated = playerHp <= 0;
  const bossDefeated = bossHp <= 0;

  if (playerDefeated) {
    combatLog += `\n💀 **${playerUser.username}** was defeated!`;
  } else if (bossDefeated) {
    combatLog += `\n🐉 **${raidBoss.bossName}** was defeated!`;
  } else {
    combatLog += `\n⏰ Battle ended - Max turns reached`;
  }

  return {
    totalPlayerDamage,
    playerDefeated,
    bossDefeated,
    combatLog
  };
}

testRaidBattle();

async function calculateBossStats() {
  const allPlayers = await UserProfile.find({});
  
  if (allPlayers.length === 0) {
    return {
      level: 1,
      attack: 50,
      defense: 30,
      maxHp: 5000
    };
  }

  let totalAvgDamage = 0;
  let totalAvgHp = 0;
  let totalAvgDefense = 0;

  for (const player of allPlayers) {
    const buffs = await calculateActiveBuffs(player);
    const playerAttack = Math.floor((25 + player.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
    const playerDefense = Math.floor((12 + player.level + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
    const playerHp = Math.floor((250 + player.level * 15 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));
    
    totalAvgHp += playerHp;
    totalAvgDefense += playerDefense;
    
    let totalDamage = 0;
    for (let i = 0; i < 10; i++) {
      const dummyDefense = 50;
      const damageReduction = dummyDefense / (dummyDefense + 100);
      let damage = playerAttack * (1 - damageReduction);
      
      const variance = 0.8 + Math.random() * 0.4;
      damage = Math.max(1, Math.floor(damage * variance));
      
      const critChance = 5 + (buffs.critChance || 0);
      if (Math.random() * 100 < critChance) {
        const critDMG = 100 + (buffs.critDMG || 0);
        damage = Math.floor(damage * (1 + critDMG / 100));
      }
      
      totalDamage += damage;
    }
    
    const avgDamagePerTurn = totalDamage / 10;
    totalAvgDamage += avgDamagePerTurn;
  }

  const avgDamageAllPlayers = totalAvgDamage / allPlayers.length;
  const avgPlayerHp = totalAvgHp / allPlayers.length;
  const avgPlayerDefense = totalAvgDefense / allPlayers.length;
  const avgLevel = allPlayers.reduce((sum, p) => sum + p.level, 0) / allPlayers.length || 1;

  const bossLevel = Math.ceil(avgLevel * 1.5);
  const maxHp = Math.ceil(10000 + allPlayers.length * (avgDamageAllPlayers * 50)); // Buffed for teamwork
  
  // ATTACK: Scaled to kill average player in ~5 turns
  const targetTurnsToKill = 5;
  const avgDodgeChance = 15;
  const damageReductionAgainstBoss = avgPlayerDefense / (avgPlayerDefense + 100);
  
  let bossAttackNeeded = Math.ceil(avgPlayerHp / targetTurnsToKill);
  bossAttackNeeded = Math.ceil(bossAttackNeeded / (1 - avgDodgeChance / 100));
  
  const baseAttack = Math.ceil(bossAttackNeeded / (1 - damageReductionAgainstBoss));
  const minAttack = Math.ceil(avgDamageAllPlayers * 1.8);
  const bossAttack = Math.max(baseAttack, minAttack);

  const bossDefense = Math.ceil((avgLevel + 12) * 1.5);

  return {
    level: bossLevel,
    attack: bossAttack,
    defense: bossDefense,
    maxHp: maxHp,
    avgPlayerHp,
    avgPlayerDefense,
    targetTurnsToKill,
    bossAttackNeeded
  };
}
