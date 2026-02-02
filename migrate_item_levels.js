const mongoose = require('mongoose');
const Item = require('./schema/Item');
require('dotenv').config();

async function migrateItemLevels() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all items without a level field
    console.log('\nSearching for items to migrate...');
    const itemsToUpdate = await Item.find({
      $or: [
        { level: { $exists: false } },
        { level: null }
      ]
    });

    console.log(`Found ${itemsToUpdate.length} items to migrate`);

    if (itemsToUpdate.length === 0) {
      console.log('✅ No items need migration. All items already have level field.');
      await mongoose.connection.close();
      return;
    }

    // Update all items to level 0
    console.log('\nUpdating items...');
    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsToUpdate) {
      try {
        item.level = 0;
        await item.save();
        successCount++;
        
        // Progress indicator
        if (successCount % 50 === 0) {
          console.log(`  Progress: ${successCount}/${itemsToUpdate.length} items updated`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Failed to update item ${item.itemId}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration Complete!');
    console.log('='.repeat(50));
    console.log(`✅ Successfully updated: ${successCount} items`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} items`);
    }
    console.log('='.repeat(50));

    // Verify migration
    console.log('\nVerifying migration...');
    const remainingItems = await Item.countDocuments({
      $or: [
        { level: { $exists: false } },
        { level: null }
      ]
    });

    if (remainingItems === 0) {
      console.log('✅ Verification passed: All items now have level field');
    } else {
      console.log(`⚠️ Warning: ${remainingItems} items still missing level field`);
    }

    // Show level distribution
    console.log('\nLevel Distribution:');
    const levelZeroCount = await Item.countDocuments({ level: 0 });
    const totalItems = await Item.countDocuments();
    console.log(`  Level 0: ${levelZeroCount} items`);
    console.log(`  Total items in database: ${totalItems}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('Migration script finished successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the migration
console.log('='.repeat(50));
console.log('ITEM LEVEL MIGRATION SCRIPT');
console.log('='.repeat(50));
console.log('This script will add level: 0 to all existing items');
console.log('');

migrateItemLevels();
