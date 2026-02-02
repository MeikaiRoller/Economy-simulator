# Gacha System & Transcendent Rarity Deployment Guide

## Overview
This document outlines how to deploy the Transcendent rarity tier and gacha summoning system when ready.

---

## System Summary

### Transcendent Rarity (🌟)
- **Color**: Hot pink (`0xff1493`)
- **Stats**: ~30-40% higher than Legendary
- **Substats**: 5 (vs Legendary's 4)
- **Exclusive to**: Gacha system only (cannot drop from adventures/dungeons)

### Gacha Command (`/summon`)
- **Cost**: 100,000 gold per pull, 1,000,000 for 10-pull (no discount)
- **Transcendent Rate**: 0.6% base
- **Pity System**: 
  - Soft pity starts at pull 75 (+0.5% per pull)
  - Hard pity at pull 90 (guaranteed Transcendent)
- **Other Drops**: Legendary (5.4%), Epic (12%), Rare (27%), Uncommon (30%), Common (25%)

---

## Deployment Steps

### Step 1: Update generateItem.js

Add Transcendent to all rarity tables:

**RARITY_COLORS:**
```javascript
const RARITY_COLORS = {
  Common: 0x808080,
  Uncommon: 0x1eff00,
  Rare: 0x0070dd,
  Epic: 0xa335ee,
  Legendary: 0xff8000,
  Transcendent: 0xff1493,  // ADD THIS
};
```

**MAIN_STAT_RANGES:**
Add `Transcendent: [X, Y]` to each slot:
- weapon: `[120, 160]`
- head: `[95, 130]`
- chest: `[350, 480]`
- hands: `[23, 32]`
- feet: `[90, 125]`
- accessory: `[65, 90]`

**SUB_STAT_RANGES:**
Add Transcendent tier to each stat:
- attack: `[60, 85]`
- attack%: `[30, 42]`
- defense: `[50, 70]`
- defense%: `[30, 42]`
- hp: `[240, 330]`
- hp%: `[30, 42]`
- critRate: `[18, 26]`
- critDMG: `[50, 70]`
- energy: `[35, 50]`
- luck: `[0.27, 0.38]`

**SUB_STAT_COUNT:**
```javascript
const SUB_STAT_COUNT = {
  Common: 2,
  Uncommon: 2,
  Rare: 3,
  Epic: 3,
  Legendary: 4,
  Transcendent: 5  // ADD THIS
};
```

---

### Step 2: Update UserProfile.js Schema

Add pity counter field to schema (after buffs section):

```javascript
  // ---GACHA SYSTEM---
  gachaPityCounter: { type: Number, default: 0 }, // Tracks pulls since last Transcendent
```

**Note**: This is safe for existing players - Mongoose will apply default value (0) automatically.

---

### Step 3: Add Summon Command

Create `commands/economy/summon.js` with the full gacha implementation.

**Key Features:**
- Costs: 100k single, 1M for 10-pull
- Defensive pity counter initialization
- Rarity rolling with soft/hard pity
- Special announcement for Transcendent pulls
- Summary display with rarity counts
- Pity counter tracking in footer

**Full code available in conversation history.**

---

### Step 4: Deploy & Test

**Pre-Deployment Checklist:**
- ✅ All three files updated
- ✅ Code reviewed
- ✅ No syntax errors (`node index.js` dry run)

**Deployment:**
1. Push code changes to production
2. Restart bot
3. Verify `/summon` appears in slash commands

**Testing:**
1. Test single pull with test account
2. Test 10-pull
3. Verify pity counter increments
4. Check gold deduction works correctly
5. Confirm items saved to inventory
6. Test with player who has no `gachaPityCounter` field (should auto-initialize)

---

## Player Announcement Template

```
🎊 NEW FEATURE: SUMMONING SYSTEM 🎊

Introducing **Transcendent Rarity** items! 🌟

Use `/summon` to spend gold for a chance at powerful new equipment:
• 1x Summon: 100,000 gold
• 10x Summon: 1,000,000 gold

Transcendent items are 30-40% stronger than Legendary with 5 substats!

🎯 Pity System:
• Rates increase after 75 pulls
• Guaranteed Transcendent at 90 pulls

Good luck, Adventurers!
```

---

## Rollback Plan (If Needed)

If issues arise, quick rollback:

1. Delete `commands/economy/summon.js`
2. Remove Transcendent from generateItem.js stat tables
3. Remove `gachaPityCounter` from UserProfile.js schema
4. Restart bot

**Note**: Any pity counters/Transcendent items already created will remain in DB but won't affect gameplay.

---

## Future Expansion Ideas

- Add rarity above Transcendent (Celestial, Divine, Primordial)
- Banner system (rate-up for specific sets/elements)
- Gacha currency (premium currency vs gold)
- Weapon/character gacha split
- Battle pass with gacha tickets
- Event banners with limited items

---

## Economic Balance Notes

**Why 100k per pull?**
- Players can sell unwanted gear for gold
- No discount on 10-pulls prevents exploit loops
- High cost makes Transcendent feel premium
- Creates endgame gold sink

**Monitor after deployment:**
- Average pulls per player per week
- Gold economy inflation/deflation
- Transcendent acquisition rate
- Player satisfaction with pity system

Adjust rates/costs if needed after 2-4 weeks of data.
