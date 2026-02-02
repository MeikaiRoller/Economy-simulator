# 🎮 REACTION SYSTEM - DEVELOPER REFERENCE

## Quick Start: Enabling New Reactions

When you want to release new content, simply:

### Option 1: Use Predefined Patches
```bash
# Edit enable_reactions.js and uncomment ONE line:
const ENABLE_PATCH = "1.1";    # Electro-Charged + Electro Swirl
const ENABLE_PATCH = "1.2";    # All Crystallize reactions
const ENABLE_PATCH = "all";    # Everything at once

# Then run:
node enable_reactions.js
```

### Option 2: Manual Selection
```bash
# Edit enable_reactions.js MANUAL_ENABLE array:
const MANUAL_ENABLE = [
  "hydro-electro",   # Enable this
  "geo-pyro",        # And this
];

# Then run:
node enable_reactions.js
```

---

## Reaction Implementation Status

### ✅ FULLY IMPLEMENTED (Active in Combat)
These reactions are coded in both setbonuses.js AND test_pvp_battle.js:

- ✅ **pyro-hydro** - Vaporize (1.5x damage)
- ✅ **pyro-cryo** - Melt (2x damage)
- ✅ **pyro-electro** - Overload (bonus damage + stun)
- ✅ **hydro-cryo** - Freeze (stun)
- ✅ **electro-cryo** - Superconduct (defense reduction)
- ✅ **anemo-pyro** - Pyro Swirl (reflect damage)
- ✅ **anemo-hydro** - Hydro Swirl (reflect + heal)
- ✅ **anemo-cryo** - Cryo Swirl (reflect + dodge reduction)

### 🔧 PARTIALLY IMPLEMENTED (Defined but Not in Combat)
These reactions are in setbonuses.js but NOT implemented in test_pvp_battle.js:

- 🔧 **hydro-electro** - Electro-Charged (DoT damage)
  - **TODO**: Add DoT tracking system to combat loop
  
- 🔧 **anemo-electro** - Electro Swirl (reflect + energy)
  - **TODO**: Add energy boost on reflect proc
  
- 🔧 **anemo-geo** - Geo Swirl (reflect + defense)
  - **TODO**: Add temporary defense buff system
  
- 🔧 **geo-pyro** - Crystallize Pyro (shield + attack)
- 🔧 **geo-hydro** - Crystallize Hydro (shield + HP)
- 🔧 **geo-electro** - Crystallize Electro (shield + energy)
- 🔧 **geo-cryo** - Crystallize Cryo (shield + crit)
  - **TODO**: Implement shield system in combat
  - **TODO**: Add temporary stat buffs from Crystallize

---

## Implementation Guide

### To Fully Implement a Reaction:

1. **Enable the Toggle** (enable_reactions.js)
   ```javascript
   "reaction-key": true
   ```

2. **Add Combat Logic** (test_pvp_battle.js)
   - Find the element reaction section (~line 230)
   - Add your reaction logic following existing patterns

3. **Update Player Guide** (CHARACTER_BUILDING_GUIDE.md)
   - Move reaction from "COMING IN FUTURE UPDATES" to "CURRENTLY ACTIVE"

### Example: Adding Electro-Charged DoT

```javascript
// In test_pvp_battle.js, add DoT tracking:
let p1ElectroChargedTurns = 0;
let p2ElectroChargedTurns = 0;

// When reaction procs:
if (p1Reaction.dotDamage) {
  p1ElectroChargedTurns = p1Reaction.duration || 3;
  reactionProcs.push(`⚡ELECTRO-CHARGED`);
}

// Each turn:
if (p1ElectroChargedTurns > 0) {
  player2.currentHp -= p1Reaction.dotDamage;
  turnLog.push(`  ${player2.name} takes ${p1Reaction.dotDamage} DoT damage!`);
  p1ElectroChargedTurns--;
}
```

---

## File Locations

- **Reaction Definitions**: `utils/setbonuses.js` (lines 109-190)
- **Reaction Toggles**: `utils/setbonuses.js` (lines 79-107)
- **Combat Implementation**: `test_pvp_battle.js` (lines 220-370)
- **Enable Script**: `enable_reactions.js` (root directory)
- **Player Guide**: `CHARACTER_BUILDING_GUIDE.md`

---

## Planned Patch Roadmap

### Patch 1.0 (Current)
✅ 8 Core Reactions Active
- Damage multipliers (Melt, Vaporize, Overload)
- Crowd control (Freeze, Superconduct)
- Swirl reactions (Pyro, Hydro, Cryo)

### Patch 1.1 (Electro Update)
- Add Electro-Charged (DoT damage)
- Add Electro Swirl (reflect + energy)
- Requires: DoT system implementation

### Patch 1.2 (Crystallize Update)
- Add Geo Swirl (reflect + defense buff)
- Add all 4 Crystallize reactions (shield system)
- Requires: Shield mechanic + temporary buff system

---

## Testing

After enabling reactions:
```bash
# Quick test
node test_pvp_battle.js

# Check if toggles worked
node -e "const { REACTION_TOGGLES } = require('./utils/setbonuses'); console.log(REACTION_TOGGLES);"
```

Expected output will show which reactions are `true` (active) vs `false` (disabled).

---

## Notes for Future Updates

**Keep Meta Fresh:**
- Don't enable all reactions at once
- Stagger releases to create evolving meta
- Each patch should shift power balance slightly
- Players will theorycraft new builds with each patch

**Balance Considerations:**
- New reactions should be ~25-30% proc rate
- DoT reactions = sustained damage over burst
- Shield reactions = defensive but reduce offensive stats
- Energy reactions = enables more ability usage

**Testing Checklist:**
- [ ] Enable reaction toggle
- [ ] Implement combat logic
- [ ] Test in PVP simulator
- [ ] Check win rates (should stay 40-60% range)
- [ ] Update player guide
- [ ] Announce patch notes!

---

Good luck with your content updates! 🎮✨
