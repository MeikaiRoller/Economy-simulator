const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const calculateActiveBuffs = require('./utils/calculateBuffs');
require('dotenv').config();

async function testNextCycleBossGeneration() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const allPlayers = await UserProfile.find({});
    
    if (allPlayers.length === 0) {
      console.log('❌ No players found!');
      await mongoose.connection.close();
      return;
    }

    console.log('='.repeat(80));
    console.log('NEXT CYCLE BOSS GENERATION TEST');
    console.log('='.repeat(80));
    console.log(`\n📊 Current Player Stats:`);
    console.log(`   Total Players: ${allPlayers.length}`);

    let totalAvgDamage = 0;
    const playerStats = [];

    // Simulate each player's damage
    for (const player of allPlayers) {
      const buffs = await calculateActiveBuffs(player);
      const playerAttack = Math.floor((25 + player.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
      
      // Simulate 10 hits to get average
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
      
      playerStats.push({
        username: player.userId,
        level: player.level,
        avgDamage: avgDamagePerTurn
      });
    }

    const avgDamageAllPlayers = totalAvgDamage / allPlayers.length;
    const avgLevel = allPlayers.reduce((sum, p) => sum + p.level, 0) / allPlayers.length;

    console.log(`   Avg Player Level: ${avgLevel.toFixed(1)}`);
    console.log(`   Avg Player Damage/Turn: ${avgDamageAllPlayers.toFixed(1)}`);

    // Calculate boss stats
    const bossLevel = Math.ceil(avgLevel * 1.5);
    const bossAttack = Math.ceil(avgDamageAllPlayers * 1.8);
    const bossDefense = Math.ceil((avgLevel + 12) * 1.5);
    const bossMaxHp = Math.ceil(5000 + allPlayers.length * (avgDamageAllPlayers * 15));

    console.log('\n' + '='.repeat(80));
    console.log('🐉 NEXT CYCLE BOSS STATS');
    console.log('='.repeat(80));
    console.log(`\n   Level: ${bossLevel}`);
    console.log(`   Attack: ${bossAttack} (${(avgDamageAllPlayers * 1.8).toFixed(1)} base)`);
    console.log(`   Defense: ${bossDefense}`);
    console.log(`   Max HP: ${bossMaxHp.toLocaleString()}`);

    // Calculate estimated damage
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMBAT ANALYSIS');
    console.log('='.repeat(80));

    const damageReduction = bossDefense / (bossDefense + 100);
    const playerDamageToBoss = avgDamageAllPlayers * (1 - damageReduction);
    const bossDamageToPlayer = bossAttack * (1 - 50 / (50 + 100));

    console.log(`\n   Avg Player Damage to Boss: ${playerDamageToBoss.toFixed(1)} per turn`);
    console.log(`   Boss Damage to Avg Player: ${bossDamageToPlayer.toFixed(1)} per turn`);
    console.log(`   Est. Turns to Defeat (all players attacking): ${(bossMaxHp / (playerDamageToBoss * allPlayers.length)).toFixed(1)} turns`);
    console.log(`   Est. Turns to Kill Avg Player: ${(250 / bossDamageToPlayer).toFixed(1)} turns`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test Complete - Boss will be generated on next cycle reset\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testNextCycleBossGeneration();
