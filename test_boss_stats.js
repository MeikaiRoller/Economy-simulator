const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const calculateActiveBuffs = require('./utils/calculateBuffs');
require('dotenv').config();

async function testBossStatCalculation() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const allPlayers = await UserProfile.find({});
    console.log(`Found ${allPlayers.length} players\n`);

    if (allPlayers.length === 0) {
      console.log('❌ No players found!');
      await mongoose.connection.close();
      return;
    }

    console.log('='.repeat(80));
    console.log('PLAYER DAMAGE ANALYSIS');
    console.log('='.repeat(80));

    let totalAvgDamage = 0;
    const playerStats = [];

    // Simulate each player's damage
    for (const player of allPlayers) {
      const buffs = await calculateActiveBuffs(player);
      const playerAttack = Math.floor((25 + player.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
      
      // Simulate 10 hits to get average
      let totalDamage = 0;
      let critCount = 0;

      for (let i = 0; i < 10; i++) {
        // Use a dummy enemy for comparison
        const dummyDefense = 50;
        const damageReduction = dummyDefense / (dummyDefense + 100);
        let damage = playerAttack * (1 - damageReduction);
        
        // Apply variance
        const variance = 0.8 + Math.random() * 0.4;
        damage = Math.max(1, Math.floor(damage * variance));
        
        // Check crit
        const critChance = 5 + (buffs.critChance || 0);
        if (Math.random() * 100 < critChance) {
          critCount++;
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
        attack: playerAttack,
        avgDamage: avgDamagePerTurn,
        critRate: 5 + (buffs.critChance || 0)
      });

      console.log(`\n👤 ${player.userId}`);
      console.log(`   Level: ${player.level}`);
      console.log(`   Attack Stat: ${playerAttack}`);
      console.log(`   Avg Damage/Turn: ${avgDamagePerTurn.toFixed(1)}`);
      console.log(`   Crit Rate: ${(5 + (buffs.critChance || 0)).toFixed(1)}%`);
    }

    const avgDamageAllPlayers = totalAvgDamage / allPlayers.length;
    const avgLevel = allPlayers.reduce((sum, p) => sum + p.level, 0) / allPlayers.length;

    console.log('\n' + '='.repeat(80));
    console.log('BOSS STAT CALCULATION');
    console.log('='.repeat(80));

    const bossLevel = Math.ceil(avgLevel * 1.5);
    const bossAttack = Math.ceil(avgDamageAllPlayers * 1.8);
    const bossDefense = Math.ceil((avgLevel + 12) * 1.5);
    const bossMaxHp = Math.ceil(10000 + allPlayers.length * (avgDamageAllPlayers * 50));

    console.log(`\nAverage Player Level: ${avgLevel.toFixed(1)}`);
    console.log(`Average Player Damage/Turn: ${avgDamageAllPlayers.toFixed(1)}`);
    console.log(`Total Players: ${allPlayers.length}\n`);

    console.log(`🐉 LE GROMP STATS:`);
    console.log(`   Level: ${bossLevel}`);
    console.log(`   Attack: ${bossAttack}`);
    console.log(`   Defense: ${bossDefense}`);
    console.log(`   Max HP: ${bossMaxHp.toLocaleString()}`);

    // Calculate damage taken
    console.log('\n' + '='.repeat(80));
    console.log('BOSS COMBAT ANALYSIS');
    console.log('='.repeat(80));

    const avgPlayerDefense = allPlayers.reduce((sum, p) => sum + (12 + p.level), 0) / allPlayers.length;
    const damageReduction = bossDefense / (bossDefense + 100);
    const avgBossDamage = Math.floor(bossAttack * (1 - (avgPlayerDefense / (avgPlayerDefense + 100))));

    console.log(`\nBoss does ~${avgBossDamage} damage per turn to avg player`);
    console.log(`Average player does ~${avgDamageAllPlayers.toFixed(1)} damage per turn to boss`);
    console.log(`Avg player has ~${(250 + avgLevel * 15).toFixed(0)} HP`);
    
    const turnsToKillBoss = Math.ceil(bossMaxHp / (avgDamageAllPlayers * allPlayers.length));
    const turnsToKillPlayer = Math.ceil((250 + avgLevel * 15) / avgBossDamage);

    console.log(`\n📊 Raid Difficulty:`);
    console.log(`   Total group damage/turn: ${(avgDamageAllPlayers * allPlayers.length).toFixed(0)}`);
    console.log(`   Estimated turns to defeat boss: ~${turnsToKillBoss} (with all players attacking every turn)`);
    console.log(`   Average player survives: ~${turnsToKillPlayer} hits from boss`);

    console.log('\n' + '='.repeat(80));
    await mongoose.connection.close();
    console.log('✅ Analysis complete');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBossStatCalculation();
