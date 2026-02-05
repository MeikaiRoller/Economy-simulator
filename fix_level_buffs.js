/**
 * Fix Level-Based Buffs After Level Rollback
 * 
 * This script recalculates userProfile.buffs to match their current level.
 * Run this after rolling back player levels to fix orphaned buff values.
 * 
 * Usage: node fix_level_buffs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');

async function fixLevelBuffs() {
  try {
    require("dotenv").config();
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env file");
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all players
    const players = await UserProfile.find({});
    console.log(`\n📊 Found ${players.length} player profiles\n`);

    let fixedCount = 0;
    let alreadyCorrect = 0;

    for (const player of players) {
      const currentLevel = player.level || 1;
      const expectedBuffValue = currentLevel * 0.1;

      // Check if buffs need fixing
      const needsFix = 
        player.buffs.attackBoost !== expectedBuffValue ||
        player.buffs.defenseBoost !== expectedBuffValue ||
        player.buffs.criticalChance !== 0 || // Should always be 0 (no longer scales with level)
        player.buffs.magicBoost !== expectedBuffValue ||
        player.buffs.magicDefenseBoost !== expectedBuffValue ||
        player.buffs.healingBoost !== expectedBuffValue ||
        player.buffs.xpBoost !== expectedBuffValue;

      if (needsFix) {
        const oldBuffs = { ...player.buffs };
        
        // Recalculate buffs based on current level
        player.buffs.attackBoost = expectedBuffValue;
        player.buffs.defenseBoost = expectedBuffValue;
        player.buffs.magicBoost = expectedBuffValue;
        player.buffs.magicDefenseBoost = expectedBuffValue;
        player.buffs.criticalChance = 0; // Crit now comes from gear only
        player.buffs.healingBoost = expectedBuffValue;
        player.buffs.xpBoost = expectedBuffValue;
        
        await player.save();
        fixedCount++;
        
        console.log(`🔧 Fixed: ${player.userId || 'Unknown'} (Level ${currentLevel})`);
        console.log(`   Old: attackBoost=${oldBuffs.attackBoost}, critChance=${oldBuffs.criticalChance}`);
        console.log(`   New: attackBoost=${expectedBuffValue}, critChance=${expectedBuffValue}\n`);
      } else {
        alreadyCorrect++;
      }
    }

    console.log('\n✅ Fix Complete!');
    console.log(`   Fixed: ${fixedCount} players`);
    console.log(`   Already correct: ${alreadyCorrect} players`);
    console.log(`   Total: ${players.length} players\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the fix
fixLevelBuffs();
