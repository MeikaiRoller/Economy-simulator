const mongoose = require('mongoose');
const Item = require('./schema/Item');
require('dotenv').config();

async function migrateChestArmorToHpPercent() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all chest items with flat HP main stat
    console.log('\nSearching for chest items with flat HP...');
    const chestItems = await Item.find({
      slot: 'chest',
      'mainStat.type': 'hp'
    });

    console.log(`Found ${chestItems.length} chest items to migrate`);

    if (chestItems.length === 0) {
      console.log('✅ No chest items need migration. All chest pieces already use HP%.');
      await mongoose.connection.close();
      return;
    }

    console.log('\nConverting flat HP to HP%...');
    let successCount = 0;
    let errorCount = 0;

    for (const item of chestItems) {
      try {
        const oldValue = item.mainStat.value;
        
        // Convert flat HP to HP% based on rarity
        // Old ranges: Common [50-90], Uncommon [90-150], Rare [150-225], Epic [225-325], Legendary [325-500]
        // New ranges: Common [8-12], Uncommon [12-18], Rare [18-25], Epic [25-35], Legendary [35-50]
        let newValue;
        switch(item.rarity) {
          case 'Common':
            // Old: 50-90, New: 8-12
            newValue = 8 + ((oldValue - 50) / (90 - 50)) * (12 - 8);
            break;
          case 'Uncommon':
            // Old: 90-150, New: 12-18
            newValue = 12 + ((oldValue - 90) / (150 - 90)) * (18 - 12);
            break;
          case 'Rare':
            // Old: 150-225, New: 18-25
            newValue = 18 + ((oldValue - 150) / (225 - 150)) * (25 - 18);
            break;
          case 'Epic':
            // Old: 225-325, New: 25-35
            newValue = 25 + ((oldValue - 225) / (325 - 225)) * (35 - 25);
            break;
          case 'Legendary':
            // Old: 325-500, New: 35-50
            newValue = 35 + ((oldValue - 325) / (500 - 325)) * (50 - 35);
            break;
          default:
            // Fallback: approximate conversion based on value
            newValue = Math.min(50, Math.max(8, oldValue / 10));
        }
        
        // Round to 1 decimal place
        newValue = Math.round(newValue * 10) / 10;
        
        // Update the item
        item.mainStat.type = 'hp%';
        item.mainStat.value = newValue;
        
        await item.save();
        successCount++;
        
        // Show detailed progress
        console.log(`  ✓ ${item.name} (${item.rarity}): ${oldValue} HP → ${newValue}% HP`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Failed to update item ${item.itemId} (${item.name}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully migrated: ${successCount} items`);
    if (errorCount > 0) {
      console.log(`❌ Failed to migrate: ${errorCount} items`);
    }
    console.log('='.repeat(50));

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Migration complete. Database connection closed.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateChestArmorToHpPercent();
