# 🎯 QUICK START - Enabling New Reactions

## When You Want to Add New Content:

### Step 1: Choose Your Patch
Edit `enable_reactions.js`, uncomment ONE line:

```javascript
const ENABLE_PATCH = "1.1";    // Electro Update
// OR
const ENABLE_PATCH = "1.2";    // Crystallize Update
// OR
const ENABLE_PATCH = "all";    // Everything at once!
```

### Step 2: Run the Script
```bash
node enable_reactions.js
```

You'll see:
```
🎮 Applying Patch: Electro Update
📝 Adds Electro-Charged and Electro Swirl reactions

✅ Enabled: hydro-electro
✅ Enabled: anemo-electro

🎉 Successfully enabled 2 reaction(s)!
```

### Step 3: Test It
```bash
node test_pvp_battle.js
```

### Step 4: Update Player Guide
Edit `CHARACTER_BUILDING_GUIDE.md`:
- Move reactions from "🔮 COMING IN FUTURE UPDATES" 
- To "⚡ CURRENTLY ACTIVE REACTIONS"

---

## That's It!

The reactions are now active in the game. Players will see them proc in battles.

**Note:** Some reactions (Crystallize, Electro-Charged) need additional combat code to fully work. See `REACTION_SYSTEM_DEV_NOTES.md` for implementation details.

---

## Quick Reference

| Patch | Reactions Added | Notes |
|-------|----------------|-------|
| 1.1 | Electro-Charged, Electro Swirl | Needs DoT system |
| 1.2 | Geo Swirl, 4x Crystallize | Needs shield system |
| all | Everything | For testing only |

---

## Current Status

✅ **Active:** 8 reactions (Melt, Vaporize, Overload, Freeze, Superconduct, Pyro/Hydro/Cryo Swirl)

🔒 **Disabled:** 7 reactions (waiting for future patches)

---

**For detailed implementation notes, see:** `REACTION_SYSTEM_DEV_NOTES.md`
