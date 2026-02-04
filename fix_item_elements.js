/**
 * FIX_ITEM_ELEMENTS.js - Patch items that are missing element property
 * 
 * Some items generated before elements were fully implemented may not have
 * the element property set. This script adds it based on setName.
 * 
 * Usage: node fix_item_elements.js
 */

const mongoose = require('mongoose');
const Item = require('./schema/Item');
require('dotenv').config();

// Set element mapping
const SET_ELEMENTS = {
  "Ethans Prowess": null,
  "Olivias Fury": "pyro",
  "Justins Clapping": "electro",
  "Lilahs Cold Heart": "cryo",
  "Hasagi": "anemo",
  "Maries Zhongli Bodypillow": "geo",
  "Andys Soraka": "hydro"
};

async function fixElements() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all items without element property or with null element
    const itemsToFix = await Item.find({
      $or: [
        { element: { $exists: false } },
        { element: null }
      ]
    });

    console.log(`📦 Found ${itemsToFix.length} items to fix\n`);

    let fixed = 0;
    for (const item of itemsToFix) {
      const newElement = SET_ELEMENTS[item.setName] || null;
      
      if (newElement !== item.element) {
        await Item.findByIdAndUpdate(item._id, { element: newElement });
        fixed++;
        
        if (fixed % 50 === 0) {
          console.log(`✅ Fixed ${fixed}/${itemsToFix.length} items...`);
        }
      }
    }

    console.log(`\n✅ Successfully fixed ${fixed} items!`);
    console.log(`   All items now have correct element properties.`);

    // Verify
    const stillMissing = await Item.countDocuments({
      $or: [
        { element: { $exists: false } },
        { element: null }
      ]
    });

    console.log(`\n📊 Verification: ${stillMissing} items still missing element property`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixElements();
