const mongoose = require('mongoose');
const Item = require('./schema/Item');
const UserProfile = require('./schema/UserProfile');
require('dotenv').config();

async function diagnoseStatCorruption() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Find yvei's profile
    const yvei = await UserProfile.findOne({ userId: '302496685873954817' });
    
    if (!yvei) {
      console.log('❌ yvei not found');
      await mongoose.connection.close();
      return;
    }

    console.log('📊 YVEI\'S EQUIPPED ITEMS DIAGNOSTICS');
    console.log('═'.repeat(80));

    const equippedItemIds = Object.values(yvei.equipped).filter(Boolean);
    
    for (const itemId of equippedItemIds) {
      const item = await Item.findOne({ itemId });
      if (!item) continue;

      console.log(`\n${item.emoji} ${item.name} (${item.rarity}) +${item.level || 0}`);
      console.log('─'.repeat(80));
      
      // Main stat
      console.log(`Main Stat: ${item.mainStat.type} = ${item.mainStat.value}`);
      
      // Sub stats
      if (item.subStats && item.subStats.length > 0) {
        console.log(`Sub Stats:`);
        for (const sub of item.subStats) {
          console.log(`  - ${sub.type}: ${sub.value}`);
          
          // Flag suspicious values
          if (sub.type.includes('%')) {
            if (sub.value > 100) {
              console.log(`    ⚠️  CORRUPTED: ${sub.value} is way too high for a % stat!`);
            } else if (sub.value > 50) {
              console.log(`    ⚠️  SUSPICIOUS: ${sub.value} seems high for a % stat`);
            }
          }
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('🔍 CHECKING ALL ITEMS FOR CORRUPTION');
    console.log('═'.repeat(80));

    const allItems = await Item.find({});
    let corruptedCount = 0;
    let suspiciousCount = 0;

    for (const item of allItems) {
      let itemCorrupted = false;
      let itemSuspicious = false;

      if (item.subStats) {
        for (const sub of item.subStats) {
          if (sub.type.includes('%')) {
            if (sub.value > 100) {
              itemCorrupted = true;
              corruptedCount++;
              console.log(`\n❌ CORRUPTED: ${item.name} (${item.itemId})`);
              console.log(`   ${sub.type}: ${sub.value} (should be ≤30 for Legendary)`);
              break;
            } else if (sub.value > 50) {
              itemSuspicious = true;
              suspiciousCount++;
            }
          }
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📈 CORRUPTION SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total Items: ${allItems.length}`);
    console.log(`Corrupted (>100%): ${corruptedCount}`);
    console.log(`Suspicious (>50%): ${suspiciousCount}`);
    console.log('═'.repeat(80));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnoseStatCorruption();
