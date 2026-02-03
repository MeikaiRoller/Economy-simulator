const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const Item = require('./schema/Item');
const calculateActiveBuffs = require('./utils/calculateBuffs');
require('dotenv').config();

async function testEquipmentDamage() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Get a player
    const player = await UserProfile.findOne({});
    
    if (!player) {
      console.log('❌ No players found!');
      await mongoose.connection.close();
      return;
    }

    console.log('='.repeat(80));
    console.log('⚔️ EQUIPMENT UPGRADE DAMAGE COMPARISON TEST');
    console.log('='.repeat(80));
    console.log(`\n👤 Player: ${player.userId}`);
    console.log(`   Base Level: ${player.level}`);

    // Get player's equipped items
    const equippedItems = await Item.find({ _id: { $in: player.equippedItems || [] } });
    
    if (equippedItems.length === 0) {
      console.log('\n❌ Player has no equipped items! Equip some items first.');
      await mongoose.connection.close();
      return;
    }

    console.log(`\n📦 Equipped Items (${equippedItems.length} items):`);
    equippedItems.forEach(item => {
      console.log(`   - ${item.name} (${item.rarity}) - Level: +${item.level || 0}`);
    });

    // Calculate damage with current items (as-is)
    console.log('\n' + '='.repeat(80));
    console.log('📊 DAMAGE CALCULATION (CURRENT GEAR)');
    console.log('='.repeat(80));

    const buffsWithCurrent = await calculateActiveBuffs(player);
    const attackWithCurrent = Math.floor(
      (25 + player.level * 2 + (buffsWithCurrent.attackFlat || 0)) * 
      (1 + buffsWithCurrent.attack)
    );
    
    console.log(`\nBase Attack: ${25 + player.level * 2}`);
    console.log(`Attack Flat Bonus: +${buffsWithCurrent.attackFlat || 0}`);
    console.log(`Attack % Bonus: +${(buffsWithCurrent.attack * 100).toFixed(1)}%`);
    console.log(`\n⚔️ Total Attack: ${attackWithCurrent}`);

    // Simulate damage against dummy (50 defense)
    const dummyDefense = 50;
    const damageReduction = dummyDefense / (dummyDefense + 100);
    const baseDamage = attackWithCurrent * (1 - damageReduction);
    const variance = 0.8 + 0.4; // avg variance = 1.0
    const avgDamage = Math.floor(baseDamage * variance);

    console.log(`\n📈 Damage vs 50 Defense Dummy:`);
    console.log(`   Base Damage (after defense): ${baseDamage.toFixed(1)}`);
    console.log(`   With Variance (0.8-1.2x avg): ${avgDamage}`);

    // Now calculate if ALL items were +15
    console.log('\n' + '='.repeat(80));
    console.log('📊 DAMAGE CALCULATION (ALL GEAR +15)');
    console.log('='.repeat(80));

    // Create copies of items at level 15
    const upgradedItems = equippedItems.map(item => ({
      ...item.toObject(),
      level: 15
    }));

    // Temporarily replace equipped items
    const originalEquippedIds = player.equippedItems;
    
    // Create temp items with level 15
    const tempItems = await Promise.all(upgradedItems.map(itemData => {
      const tempItem = new Item(itemData);
      return tempItem.save();
    }));

    player.equippedItems = tempItems.map(item => item._id);
    await player.save();

    // Calculate buffs with upgraded items
    const buffsWithUpgraded = await calculateActiveBuffs(player);
    const attackWithUpgraded = Math.floor(
      (25 + player.level * 2 + (buffsWithUpgraded.attackFlat || 0)) * 
      (1 + buffsWithUpgraded.attack)
    );

    console.log(`\nBase Attack: ${25 + player.level * 2}`);
    console.log(`Attack Flat Bonus: +${buffsWithUpgraded.attackFlat || 0}`);
    console.log(`Attack % Bonus: +${(buffsWithUpgraded.attack * 100).toFixed(1)}%`);
    console.log(`\n⚔️ Total Attack: ${attackWithUpgraded}`);

    const baseDamageUpgraded = attackWithUpgraded * (1 - damageReduction);
    const avgDamageUpgraded = Math.floor(baseDamageUpgraded * variance);

    console.log(`\n📈 Damage vs 50 Defense Dummy:`);
    console.log(`   Base Damage (after defense): ${baseDamageUpgraded.toFixed(1)}`);
    console.log(`   With Variance (0.8-1.2x avg): ${avgDamageUpgraded}`);

    // Show comparison
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON');
    console.log('='.repeat(80));

    const damageDifference = avgDamageUpgraded - avgDamage;
    const damagePercentIncrease = ((avgDamageUpgraded - avgDamage) / avgDamage * 100).toFixed(1);

    console.log(`\n Current Gear Damage: ${avgDamage}`);
    console.log(`+15 Gear Damage:      ${avgDamageUpgraded}`);
    console.log(`\n📈 Difference: +${damageDifference} damage (${damagePercentIncrease}% increase)`);

    // Clean up temp items
    player.equippedItems = originalEquippedIds;
    await player.save();
    await Item.deleteMany({ _id: { $in: tempItems.map(t => t._id) } });

    await mongoose.connection.close();
    console.log('\n✅ Test Complete\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testEquipmentDamage();
