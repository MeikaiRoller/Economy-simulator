# 🎛️ FEATURE TOGGLES - Quick Reference

## Shop System

**Current Status:** 🔴 **DISABLED**

### To Re-Enable Shop:

Edit `commands/economy/shop.js` line 10:
```javascript
const SHOP_ENABLED = true;  // Change false to true
```

### Why Disabled?
- Forces players to grind for items through adventures
- Makes item quality and drops more valuable
- Creates scarcity and engagement
- Shop will be reworked for future update

### When to Re-Enable:
- After implementing new shop features (rotating stock, rare items, etc.)
- When you want to add a gold sink
- As part of economy balance patch

---

## Quick Toggle Reference

| Feature | File | Line | Status |
|---------|------|------|--------|
| Shop | `commands/economy/shop.js` | 10 | 🔴 Disabled |
| Reactions (Various) | `utils/setbonuses.js` | 79-95 | ⚡ See `enable_reactions.js` |

---

## Player Message When Disabled

When players try `/shop`, they see:
```
🏪 Shop Temporarily Closed
The shop is currently closed for renovations! 🔨

How to Get Items:
• 🗡️ Go on adventures with /adventure
• 💰 Defeat enemies and find treasure
• 🎲 Better luck = better loot!

The shop will return in a future update with new features!
```

---

## Testing

After changing toggles:
```bash
# Restart your bot
# Try /shop command in Discord
# Should see "closed" message if disabled
```

---

## Future Shop Rework Ideas

**Potential Features:**
- [ ] Daily featured items (higher quality)
- [ ] Shop levels (unlock better items)
- [ ] Bulk buy discounts
- [ ] Special currency for shop (tokens)
- [ ] Mystery boxes
- [ ] Limited time offers
- [ ] Player-to-player marketplace

**Economy Balance:**
- Current: Players can only get items from adventures (pure grind)
- Future: Shop provides alternative but adventures still primary source
- Shop items might be more expensive but guaranteed quality
