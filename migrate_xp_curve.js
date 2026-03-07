/**
 * migrate_xp_curve.js
 *
 * Migrates all player levels/XP from the old formula:
 *   OLD: Math.floor(100 * Math.pow(level, 1.5))
 * to the new exponential formula:
 *   NEW: Math.floor(300 * Math.pow(1.2, level))
 *
 * How it works:
 *   1. Reconstructs each player's total lifetime XP from their current
 *      level + leftover XP using the OLD formula.
 *   2. Re-calculates their level from scratch using the NEW formula.
 *   3. Saves the updated level and leftover XP.
 *
 * Run with: node migrate_xp_curve.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");

// ── XP Formulas ──────────────────────────────────────────────────────────────

function xpForLevelOld(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function xpForLevelNew(level) {
  return Math.floor(300 * Math.pow(1.2, level));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculates the total XP a player has earned over their lifetime
 * using the OLD formula, from their stored level + leftover xp.
 */
function reconstructTotalXP(level, leftoverXp) {
  let total = leftoverXp;
  // Sum the cost of every level from 1 up to (level - 1)
  for (let l = 1; l < level; l++) {
    total += xpForLevelOld(l);
  }
  return total;
}

/**
 * Given a pool of total XP, calculates the new level and leftover XP
 * using the NEW formula.
 */
function calculateNewLevel(totalXp) {
  let level = 1;
  let remaining = totalXp;

  while (remaining >= xpForLevelNew(level)) {
    remaining -= xpForLevelNew(level);
    level++;

    // Safety cap — prevents infinite loop if XP is astronomically high
    if (level >= 200) break;
  }

  return { level, xp: remaining };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.\n");

  const profiles = await UserProfile.find({});
  console.log(`📊 Found ${profiles.length} player profiles to migrate.\n`);

  let migrated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const profile of profiles) {
    try {
      const oldLevel = profile.level;
      const oldXp = profile.xp;

      // Step 1: Reconstruct total XP earned using old formula
      const totalXp = reconstructTotalXP(oldLevel, oldXp);

      // Step 2: Recalculate with new formula
      const { level: newLevel, xp: newXp } = calculateNewLevel(totalXp);

      if (newLevel === oldLevel && newXp === oldXp) {
        unchanged++;
        continue;
      }

      // Step 3: Save
      profile.level = newLevel;
      profile.xp = newXp;
      await profile.save();

      console.log(
        `✔ ${profile.userId.padEnd(20)} | Level ${String(oldLevel).padStart(3)} → ${String(newLevel).padStart(3)} | XP ${String(oldXp).padStart(8)} → ${String(newXp).padStart(8)}`
      );
      migrated++;
    } catch (err) {
      console.error(`✘ Error migrating user ${profile.userId}:`, err.message);
      errors++;
    }
  }

  console.log("\n── Migration Complete ─────────────────────────────");
  console.log(`  ✔ Migrated : ${migrated}`);
  console.log(`  ─ Unchanged: ${unchanged}`);
  console.log(`  ✘ Errors   : ${errors}`);
  console.log("───────────────────────────────────────────────────");

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

migrate().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
