/**
 * sim_server.js
 * Local dev server for the Set Build Simulator UI.
 * Run: node sim_server.js
 * Open: http://localhost:3069
 */
require('dotenv').config();
const express  = require('express');
const path     = require('path');
const { ALL_SETS, THREE_PC, SUBSTAT_KEYS, SUBSTAT_PROFILES, DEFAULT_SUBPROFILE, FLEX_MAIN_POOL, DEFAULT_MAINS,
        getDR, buildPlayer, buildMixedPlayer, runSuite, sbConfig } = require('./utils/simEngine');

const app  = express();
const PORT = 3069;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sim.html')));

// ─── GET /api/sets ─────────────────────────────────────────────────────────────
// Returns all set names and their 3pc bonus summary for the UI dropdowns.
app.get('/api/sets', (req, res) => {
  const sets = ALL_SETS.map(name => {
    const b = THREE_PC[name] || {};
    const tags = [];
    if (b.decayProcChance)  tags.push(`DoT ${(b.decayProcChance * 100).toFixed(0)}% proc`);
    if (b.setAttackPct)     tags.push(`+${(b.setAttackPct * 100).toFixed(0)}% ATK`);
    if (b.setProcRate)      tags.push(`proc ${(b.setProcRate * 100).toFixed(0)}%`);
    if (b.setCritChance)    tags.push(`+${b.setCritChance} CR`);
    if (b.setCritDMG)       tags.push(`+${b.setCritDMG} CD`);
    if (b.setEnergy)        tags.push(`+${b.setEnergy} energy`);
    if (b.setDefensePct)    tags.push(`+${(b.setDefensePct * 100).toFixed(0)}% DEF`);
    if (b.setHpPct)         tags.push(`+${(b.setHpPct * 100).toFixed(0)}% HP`);
    if (b.dodge)            tags.push(`dodge ${b.dodge}%`);
    return { name, tags3pc: tags.join(', ') };
  });
  res.json({ sets });
});

// ─── GET /api/substats ────────────────────────────────────────────────────────
// Returns available substat keys, profile names, and full profile definitions.
app.get('/api/substats', (req, res) => {
  res.json({ keys: SUBSTAT_KEYS, profiles: SUBSTAT_PROFILES, defaultProfile: DEFAULT_SUBPROFILE, flexMainPool: FLEX_MAIN_POOL, defaultMains: DEFAULT_MAINS });
});

// ─── GET /api/boss ─────────────────────────────────────────────────────────────
// Returns the live raid boss stats (or fallback if none active).
app.get('/api/boss', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const RaidBoss = require('./schema/RaidBoss');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    const boss = await RaidBoss.findOne({ active: true });
    if (boss && boss.maxHp > 0) {
      res.json({ name: boss.bossName || 'Raid Boss', attack: boss.attack, defense: boss.defense, maxHp: boss.maxHp, live: true });
    } else {
      res.json({ name: 'Fallback Boss', attack: 1080, defense: 90, maxHp: 158385, live: false });
    }
  } catch {
    res.json({ name: 'Fallback Boss', attack: 1080, defense: 90, maxHp: 158385, live: false });
  }
});

// ─── POST /api/build ──────────────────────────────────────────────────────────
// Computes player stats from a set config. Applies manual overrides on top.
// Body: { rarity, mode, set1, set2?, overrides?, subProfile?, itemLevel?, mains?, level? }
app.post('/api/build', (req, res) => {
  const { rarity = 'Legendary', mode = '6pc', set1, set2, overrides = {}, subProfile = null, itemLevel = 10, mains = null, level = 85 } = req.body;
  if (!set1) return res.status(400).json({ error: 'set1 is required' });

  let player;
  try {
    player = mode === '6pc'
      ? buildPlayer(rarity, set1, subProfile || undefined, Number(itemLevel), mains || undefined, Number(level))
      : buildMixedPlayer(rarity, set1, set2 || set1, subProfile || undefined, Number(itemLevel), mains || undefined, Number(level));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Apply manual stat overrides (user-edited fields)
  const num = (v) => v !== undefined && v !== '' ? Number(v) : undefined;
  if (num(overrides.attack)   !== undefined) player.attack   = num(overrides.attack);
  if (num(overrides.defense)  !== undefined) player.defense  = num(overrides.defense);
  if (num(overrides.hp)       !== undefined) player.hp       = num(overrides.hp);
  if (num(overrides.energy)   !== undefined) player.energy   = num(overrides.energy);
  if (num(overrides.crit)     !== undefined) player.crit     = num(overrides.crit);
  if (num(overrides.critMult) !== undefined) player.critMult = num(overrides.critMult);
  player.dr = (getDR(player.defense) * 100).toFixed(1);

  res.json(player);
});

// ─── POST /api/simulate ───────────────────────────────────────────────────────
// Runs N fights with the given player and boss, returns suite results.
// Body: { player, boss, n? }
app.post('/api/simulate', (req, res) => {
  const { player, boss, n = 50 } = req.body;
  if (!player || !boss) return res.status(400).json({ error: 'player and boss required' });
  const cfg    = sbConfig(player);
  const suite  = runSuite(player, boss, Math.min(Number(n) || 50, 500), cfg);
  res.json(suite);
});

// ─── Start (local dev) / Export (Vercel) ─────────────────────────────────────
async function start() {
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch {
    console.warn('⚠️  MongoDB unavailable — boss loading disabled, sim still works');
  }
  app.listen(PORT, () => {
    console.log(`\n🎮  Set Build Simulator running at http://localhost:${PORT}\n`);
  });
}

if (require.main === module) {
  // Running directly: node sim_server.js
  start();
} else {
  // Imported by Vercel serverless — no mongoose at module load time
  module.exports = app;
}
