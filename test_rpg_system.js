require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");
const Item = require("./schema/Item");
const { generateItem, rollRarity } = require("./utils/generateItem");
const calculateActiveBuffs = require("./utils/calculateBuffs");
const { calculateSetBonuses } = require("./utils/setbonuses");

async function testRPGSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to Database\n");

    // ========== TEST 1: Generate and Save Items ==========
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 TEST 1: Generating Procedural Items");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const testItems = [];
    const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'accessory'];
    const sets = ['Ethans Prowess', 'Olivias Fury', 'Justins Clapping', 'Lilahs Cold Heart', 'Hasagi', 'Maries Zhongli Bodypillow', 'Andys Soraka'];

    // Generate a full set of equipment
    console.log("Generating a complete Olivias Fury (Pyro) set...\n");
    for (const slot of slots) {
      const rarity = rollRarity(true); // Boss drop rates
      const itemData = generateItem(slot, rarity, 'Olivias Fury');
      
      const newItem = new Item({
        itemId: itemData.itemId,
        name: itemData.name,
        description: itemData.description,
        emoji: itemData.emoji,
        slot: itemData.slot,
        setName: itemData.setName,
        element: itemData.element,
        mainStat: itemData.mainStat,
        subStats: itemData.subStats,
        rarity: itemData.rarity,
        price: itemData.price,
        shopPrice: itemData.shopPrice
      });
      
      await newItem.save();
      testItems.push(newItem);
      
      console.log(`${itemData.emoji} ${itemData.name} [${itemData.rarity.toUpperCase()}]`);
      console.log(`   Set: ${itemData.setName} ${itemData.element ? `(${itemData.element})` : ''}`);
      console.log(`   Main Stat: ${itemData.mainStat.type} +${itemData.mainStat.value}`);
      console.log(`   Sub Stats:`);
      itemData.subStats.forEach(stat => {
        console.log(`      - ${stat.type}: +${stat.value}${stat.type.includes('Percent') ? '%' : ''}`);
      });
      console.log();
    }

    // ========== TEST 2: Create Test User ==========
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👤 TEST 2: Creating Test User with Equipment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Clean up existing test user
    await UserProfile.deleteOne({ userId: "test_user_123" });

    const testUser = new UserProfile({
      userId: "test_user_123",
      balance: 100000,
      level: 25,
      xp: 5000,
      equipped: {
        weapon: testItems.find(i => i.slot === 'weapon')?.itemId,
        head: testItems.find(i => i.slot === 'head')?.itemId,
        chest: testItems.find(i => i.slot === 'chest')?.itemId,
        hands: testItems.find(i => i.slot === 'hands')?.itemId,
        feet: testItems.find(i => i.slot === 'feet')?.itemId,
        accessory: testItems.find(i => i.slot === 'accessory')?.itemId,
      },
      inventory: testItems.map(item => ({ itemId: item.itemId, quantity: 1 })),
      pvpStats: {
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0
      }
    });

    await testUser.save();
    console.log("✅ Created test user with full Olivias Fury set equipped\n");

    // ========== TEST 3: Calculate Buffs ==========
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 TEST 3: Calculating Buffs and Set Bonuses");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const buffs = await calculateActiveBuffs(testUser);
    
    console.log("Base Stats (from level 25):");
    console.log(`   Attack: ${25 + testUser.level * 2}`);
    console.log(`   Defense: ${10 + testUser.level}`);
    console.log(`   HP: ${250 + testUser.level * 5}\n`);

    console.log("Buff Summary:");
    console.log(`   Attack Bonus: +${buffs.attack}%`);
    console.log(`   Attack Flat: +${buffs.attackFlat || 0}`);
    console.log(`   Defense Bonus: +${buffs.defense}%`);
    console.log(`   Defense Flat: +${buffs.defenseFlat || 0}`);
    console.log(`   HP Bonus: +${buffs.hpPercent || 0}%`);
    console.log(`   HP Flat: +${buffs.hpFlat || 0}`);
    console.log(`   Crit Rate: ${buffs.critRate || 0}%`);
    console.log(`   Crit Damage: ${buffs.critDMG || 0}%`);
    console.log(`   Dodge: ${buffs.dodge || 0}%`);
    console.log(`   Proc Rate: ${buffs.procRate || 0}%\n`);

    if (buffs.setInfo) {
      console.log("Set Bonuses:");
      if (buffs.setInfo.activeSetBonuses.length > 0) {
        buffs.setInfo.activeSetBonuses.forEach(bonus => {
          console.log(`   ${bonus.setName} (${bonus.pieces} pieces):`);
          if (bonus.bonuses && typeof bonus.bonuses === 'object') {
            Object.entries(bonus.bonuses).forEach(([stat, value]) => {
              console.log(`      - ${stat}: +${value}${stat.includes('Percent') || stat.includes('Rate') || stat.includes('Damage') ? '%' : ''}`);
            });
          }
        });
      }
      
      if (buffs.setInfo.activeElements.length > 0) {
        console.log(`\n   Active Elements: ${buffs.setInfo.activeElements.join(', ')}`);
      }
      
      if (buffs.setInfo.elementalResonance) {
        console.log(`   ✨ Elemental Resonance: ${buffs.setInfo.elementalResonance.name}`);
        console.log(`      ${buffs.setInfo.elementalResonance.description}`);
      }
      
      if (buffs.setInfo.elementalReaction) {
        console.log(`   🌟 Elemental Reaction: ${buffs.setInfo.elementalReaction.name}`);
        console.log(`      ${buffs.setInfo.elementalReaction.description}`);
      }
    }

    // ========== TEST 4: Simulate PVP Combat ==========
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚔️  TEST 4: Simulating PVP Combat");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Create opponent with different set (Lilahs Cold Heart - Cryo)
    await UserProfile.deleteOne({ userId: "test_opponent_456" });
    
    const opponentItems = [];
    console.log("Generating opponent's Lilahs Cold Heart (Cryo) set...\n");
    for (const slot of slots) {
      const rarity = rollRarity(true);
      const itemData = generateItem(slot, rarity, 'Lilahs Cold Heart');
      
      const newItem = new Item({
        itemId: itemData.itemId,
        name: itemData.name,
        description: itemData.description,
        emoji: itemData.emoji,
        slot: itemData.slot,
        setName: itemData.setName,
        element: itemData.element,
        mainStat: itemData.mainStat,
        subStats: itemData.subStats,
        rarity: itemData.rarity,
        price: itemData.price,
        shopPrice: itemData.shopPrice
      });
      
      await newItem.save();
      opponentItems.push(newItem);
    }

    const opponent = new UserProfile({
      userId: "test_opponent_456",
      balance: 100000,
      level: 25,
      xp: 5000,
      equipped: {
        weapon: opponentItems.find(i => i.slot === 'weapon')?.itemId,
        head: opponentItems.find(i => i.slot === 'head')?.itemId,
        chest: opponentItems.find(i => i.slot === 'chest')?.itemId,
        hands: opponentItems.find(i => i.slot === 'hands')?.itemId,
        feet: opponentItems.find(i => i.slot === 'feet')?.itemId,
        accessory: opponentItems.find(i => i.slot === 'accessory')?.itemId,
      },
      inventory: opponentItems.map(item => ({ itemId: item.itemId, quantity: 1 })),
      pvpStats: {
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0
      }
    });

    await opponent.save();
    console.log("✅ Created opponent with full Lilahs Cold Heart set\n");

    const opponentBuffs = await calculateActiveBuffs(opponent);

    console.log("Combat Matchup:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔥 Player (Olivias Fury - Pyro)");
    console.log(`   Level: ${testUser.level}`);
    console.log(`   Attack: ${Math.floor((25 + testUser.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack / 100))}`);
    console.log(`   Defense: ${Math.floor((10 + testUser.level + (buffs.defenseFlat || 0)) * (1 + buffs.defense / 100))}`);
    console.log(`   HP: ${Math.floor((250 + testUser.level * 5 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0) / 100))}`);
    console.log(`   Crit: ${buffs.critRate || 0}% / ${buffs.critDMG || 0}%`);
    console.log(`   Dodge: ${Math.min(buffs.dodge || 0, 50)}%\n`);

    console.log("❄️  Opponent (Lilahs Cold Heart - Cryo)");
    console.log(`   Level: ${opponent.level}`);
    console.log(`   Attack: ${Math.floor((25 + opponent.level * 2 + (opponentBuffs.attackFlat || 0)) * (1 + opponentBuffs.attack / 100))}`);
    console.log(`   Defense: ${Math.floor((10 + opponent.level + (opponentBuffs.defenseFlat || 0)) * (1 + opponentBuffs.defense / 100))}`);
    console.log(`   HP: ${Math.floor((250 + opponent.level * 5 + (opponentBuffs.hpFlat || 0)) * (1 + (opponentBuffs.hpPercent || 0) / 100))}`);
    console.log(`   Crit: ${opponentBuffs.critRate || 0}% / ${opponentBuffs.critDMG || 0}%`);
    console.log(`   Dodge: ${Math.min(opponentBuffs.dodge || 0, 50)}%\n`);

    console.log("Expected Elemental Interactions:");
    console.log("   🌟 If both hit: Melt reaction (Pyro + Cryo)");
    console.log("   🌟 Melt: 2.0x damage multiplier + 20% proc chance\n");

    // ========== TEST 5: Item Drop Simulation ==========
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎲 TEST 5: Simulating Adventure Drops");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("Simulating 10 boss drops...\n");
    const rarityCount = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    
    for (let i = 0; i < 10; i++) {
      const rarity = rollRarity(true);
      rarityCount[rarity]++;
    }

    console.log("Boss Drop Rarity Distribution:");
    Object.entries(rarityCount).forEach(([rarity, count]) => {
      const percentage = (count / 10 * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`   ${rarity.padEnd(10)}: ${bar} ${count}/10 (${percentage}%)`);
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ All Tests Completed Successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Cleanup
    console.log("Cleaning up test data...");
    await UserProfile.deleteOne({ userId: "test_user_123" });
    await UserProfile.deleteOne({ userId: "test_opponent_456" });
    await Item.deleteMany({ itemId: { $in: [...testItems, ...opponentItems].map(i => i.itemId) } });
    console.log("✅ Cleanup complete\n");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database");
  }
}

testRPGSystem();
