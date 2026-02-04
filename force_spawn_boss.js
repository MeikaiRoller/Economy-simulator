const mongoose = require('mongoose');
const RaidBoss = require('./schema/RaidBoss');
const UserProfile = require('./schema/UserProfile');
const calculateActiveBuffs = require('./utils/calculateBuffs');
require('dotenv').config();

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
  const maxHp = Math.ceil(10000 + allPlayers.length * (avgDamageAllPlayers * 50));

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
    maxHp: maxHp
  };
}

async function forceSpawnBoss() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const bossStats = await calculateBossStats();
    const bossPayload = {
      bossName: "Le Gromp",
      bossDescription: "An ancient amphibian guardian that grows stronger with each challenger",
      currentHp: bossStats.maxHp,
      maxHp: bossStats.maxHp,
      attack: bossStats.attack,
      defense: bossStats.defense,
      level: bossStats.level,
      leaderboard: [],
      participantsThisCycle: [],
      cycleStartTime: new Date(),
      bossDefeatedTime: null
    };

    const existing = await RaidBoss.findOne({});

    if (existing) {
      await RaidBoss.updateOne({ _id: existing._id }, { $set: bossPayload });
      console.log('✅ Existing boss replaced immediately (cooldown cleared).');
    } else {
      await RaidBoss.create(bossPayload);
      console.log('✅ New boss created immediately (cooldown cleared).');
    }

    console.log(`🐉 Boss Level: ${bossStats.level}`);
    console.log(`⚔️  Attack: ${bossStats.attack}`);
    console.log(`🛡️  Defense: ${bossStats.defense}`);
    console.log(`❤️  Max HP: ${bossStats.maxHp.toLocaleString()}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

forceSpawnBoss();
