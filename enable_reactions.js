/**
 * REACTION ENABLER - Quick Script for Content Updates
 * 
 * Use this script to quickly enable new reactions for patches/updates
 * 
 * Usage:
 * 1. Uncomment the reactions you want to enable
 * 2. Run: node enable_reactions.js
 * 3. Test in-game or with: node test_pvp_battle.js
 */

const fs = require('fs');
const path = require('path');

// ====================================================================
// PATCH CONFIGURATIONS
// ====================================================================

const PATCHES = {
  "1.1": {
    name: "Electro Update",
    description: "Adds Electro-Charged and Electro Swirl reactions",
    reactions: [
      "hydro-electro",   // Electro-Charged
      "anemo-electro"    // Electro Swirl
    ]
  },
  
  "1.2": {
    name: "Crystallize Update",
    description: "Adds all Geo-based Crystallize reactions",
    reactions: [
      "anemo-geo",       // Geo Swirl
      "geo-pyro",        // Crystallize (Pyro)
      "geo-hydro",       // Crystallize (Hydro)
      "geo-electro",     // Crystallize (Electro)
      "geo-cryo"         // Crystallize (Cryo)
    ]
  },
  
  "all": {
    name: "Enable All Reactions",
    description: "Activates every reaction in the game",
    reactions: [
      "hydro-electro",
      "anemo-electro",
      "anemo-geo",
      "geo-pyro",
      "geo-hydro",
      "geo-electro",
      "geo-cryo"
    ]
  }
};

// ====================================================================
// CONFIGURATION - CHOOSE YOUR PATCH
// ====================================================================

// Uncomment ONE of these to enable a patch:
// const ENABLE_PATCH = "1.1";    // Enable Electro reactions
// const ENABLE_PATCH = "1.2";    // Enable Crystallize reactions
// const ENABLE_PATCH = "all";    // Enable ALL reactions

const ENABLE_PATCH = null; // Set to null to manually choose reactions below

// OR manually enable specific reactions:
const MANUAL_ENABLE = [
  // "hydro-electro",   // Electro-Charged
  // "anemo-electro",   // Electro Swirl
  // "anemo-geo",       // Geo Swirl
  // "geo-pyro",        // Crystallize (Pyro)
  // "geo-hydro",       // Crystallize (Hydro)
  // "geo-electro",     // Crystallize (Electro)
  // "geo-cryo"         // Crystallize (Cryo)
];

// ====================================================================
// SCRIPT - DO NOT EDIT BELOW THIS LINE
// ====================================================================

function enableReactions() {
  const setBonusesPath = path.join(__dirname, 'utils', 'setbonuses.js');
  let content = fs.readFileSync(setBonusesPath, 'utf8');
  
  // Determine which reactions to enable
  let reactionsToEnable = [];
  
  if (ENABLE_PATCH && PATCHES[ENABLE_PATCH]) {
    const patch = PATCHES[ENABLE_PATCH];
    console.log(`\n🎮 Applying Patch: ${patch.name}`);
    console.log(`📝 ${patch.description}\n`);
    reactionsToEnable = patch.reactions;
  } else if (MANUAL_ENABLE.length > 0) {
    console.log(`\n🔧 Manual Reaction Enable Mode\n`);
    reactionsToEnable = MANUAL_ENABLE;
  } else {
    console.log(`\n⚠️  No reactions selected to enable!`);
    console.log(`\nPlease edit enable_reactions.js and:`);
    console.log(`  1. Set ENABLE_PATCH to "1.1", "1.2", or "all"`);
    console.log(`  2. OR uncomment reactions in MANUAL_ENABLE array\n`);
    return;
  }
  
  let changesCount = 0;
  
  // Enable each reaction
  reactionsToEnable.forEach(reactionKey => {
    const regex = new RegExp(`"${reactionKey}":\\s*false`, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, `"${reactionKey}": true`);
      console.log(`✅ Enabled: ${reactionKey}`);
      changesCount++;
    } else {
      console.log(`⚠️  Already enabled or not found: ${reactionKey}`);
    }
  });
  
  if (changesCount > 0) {
    // Write back to file
    fs.writeFileSync(setBonusesPath, content, 'utf8');
    console.log(`\n🎉 Successfully enabled ${changesCount} reaction(s)!`);
    console.log(`\n📋 Next Steps:`);
    console.log(`  1. Implement reaction logic in test_pvp_battle.js (if not already done)`);
    console.log(`  2. Test with: node test_pvp_battle.js`);
    console.log(`  3. Update CHARACTER_BUILDING_GUIDE.md to move reactions from "Coming Soon" to "Active"\n`);
  } else {
    console.log(`\n❌ No changes made - all selected reactions already enabled\n`);
  }
}

// Run the script
enableReactions();
