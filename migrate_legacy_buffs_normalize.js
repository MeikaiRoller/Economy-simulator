require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");

const FIELDS_TO_NORMALIZE = [
  "attackBoost",
  "defenseBoost",
  "magicBoost",
  "magicDefenseBoost",
  "xpBoost",
  "healingBoost",
  "luckBoost",
  "lootBoost",
  "findRateBoost",
  "cooldownReduction",
];

function normalizePercent(value) {
  if (value === undefined || value === null) return 0;
  const num = Number(value) || 0;
  return num > 1 ? num / 100 : num;
}

async function runMigration() {
  console.log("Starting legacy buff normalization...");

  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const profiles = await UserProfile.find({ "buffs": { $exists: true, $ne: null } });
  let updatedCount = 0;
  let totalChanges = 0;

  for (const profile of profiles) {
    let changed = false;

    for (const field of FIELDS_TO_NORMALIZE) {
      const raw = profile.buffs?.[field];
      if (raw === undefined || raw === null) continue;

      const normalized = normalizePercent(raw);
      if (normalized !== raw) {
        profile.buffs[field] = normalized;
        changed = true;
        totalChanges += 1;
      }
    }

    if (changed) {
      await profile.save();
      updatedCount += 1;
    }
  }

  console.log(`Profiles updated: ${updatedCount}`);
  console.log(`Fields normalized: ${totalChanges}`);
  console.log("Legacy buff normalization complete.");

  await mongoose.disconnect();
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
