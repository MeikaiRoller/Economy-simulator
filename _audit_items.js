require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");
const Item = require("./schema/Item");

function getLevelBonus(level) {
  let b = 0;
  for (let i = 1; i <= level; i++) b += i <= 5 ? 2 : i <= 10 ? 3 : 4;
  return b;
}

function fmt(type, value, lvlBonus) {
  const multiplied = value * (1 + lvlBonus / 100);
  // Percent-like stats stored as small decimals or whole numbers
  if (["critRate", "critDMG", "attack%", "defense%", "hp%", "dodge", "energy", "luck"].includes(type)) {
    return multiplied.toFixed(1);
  }
  return Math.floor(multiplied).toString();
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const profiles = await UserProfile.find({});
  const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Transcendent"];

  for (const p of profiles) {
    const equippedIds = Object.entries(p.equipped || {}).filter(([, v]) => v);
    if (!equippedIds.length) continue;

    console.log(`\n${"═".repeat(90)}`);
    console.log(`  User ${p.userId}  |  Level ${p.level}`);
    console.log(`${"═".repeat(90)}`);
    console.log(`  ${"Slot".padEnd(11)}${"Rarity".padEnd(14)}${"Set".padEnd(28)}${"Lvl".padEnd(5)}${"Main Stat".padEnd(20)}Sub Stats`);
    console.log(`  ${"-".repeat(85)}`);

    let totalCritRate = 0;
    let totalCritDMG  = 0;

    for (const [slot, itemId] of equippedIds) {
      const item = await Item.findOne({ itemId });
      if (!item) {
        console.log(`  ${slot.padEnd(11)}NOT FOUND: ${itemId}`);
        continue;
      }

      const lvlBonus = getLevelBonus(item.level || 0);
      const mainStr  = item.mainStat
        ? `${item.mainStat.type}=${fmt(item.mainStat.type, item.mainStat.value, lvlBonus)}`
        : "—";

      const subStr = (item.subStats || []).map(s => `${s.type}=${fmt(s.type, s.value, lvlBonus)}`).join("  ");

      // Accumulate crit for summary
      if (item.mainStat?.type === "critRate") totalCritRate += item.mainStat.value * (1 + lvlBonus / 100);
      if (item.mainStat?.type === "critDMG")  totalCritDMG  += item.mainStat.value * (1 + lvlBonus / 100);
      for (const s of item.subStats || []) {
        if (s.type === "critRate") totalCritRate += s.value * (1 + lvlBonus / 100);
        if (s.type === "critDMG")  totalCritDMG  += s.value * (1 + lvlBonus / 100);
      }

      console.log(
        `  ${slot.padEnd(11)}` +
        `${item.rarity.padEnd(14)}` +
        `${(item.setName || "—").slice(0, 27).padEnd(28)}` +
        `${"+" + (item.level || 0)}`.padEnd(5) +
        `${mainStr.padEnd(20)}` +
        subStr
      );
    }

    console.log(`\n  ► Gear crit rate total: ${totalCritRate.toFixed(1)}%   Gear critDMG total: ${totalCritDMG.toFixed(1)}%`);
    console.log(`    (These are added on top of the base 5% crit and 100% critDMG)`);
  }

  // ── Global item stat ranges audit ─────────────────────────────────────────
  console.log(`\n\n${"═".repeat(90)}`);
  console.log(`  GLOBAL ITEM STAT AUDIT — Top 10 highest values per stat`);
  console.log(`${"═".repeat(90)}`);

  const allItems = await Item.find({});
  const statBuckets = {};

  for (const item of allItems) {
    const lvlBonus = getLevelBonus(item.level || 0);
    const addStat = (type, value) => {
      if (!statBuckets[type]) statBuckets[type] = [];
      statBuckets[type].push({
        value: value * (1 + lvlBonus / 100),
        itemId: item.itemId.slice(0, 30),
        rarity: item.rarity,
        level: item.level || 0,
        set: (item.setName || "—").slice(0, 20),
      });
    };
    if (item.mainStat) addStat(item.mainStat.type, item.mainStat.value);
    for (const s of item.subStats || []) addStat(s.type, s.value);
  }

  for (const [stat, entries] of Object.entries(statBuckets).sort()) {
    const top = entries.sort((a, b) => b.value - a.value).slice(0, 5);
    console.log(`\n  ${stat}`);
    for (const e of top) {
      console.log(`    ${e.value.toFixed(1).padStart(8)}  [+${e.level}] ${e.rarity.padEnd(12)} ${e.set}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
