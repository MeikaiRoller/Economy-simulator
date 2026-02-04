# Combat & Stat Calculation Deep Dive

## ⚔️ CORE STAT FORMULAS

### Base Stats (Before Buffs)
```
baseAttack = 25 + (Level × 2)          // +2 per level
baseDefense = 12 + (Level × 1)         // +1 per level  
baseHp = 250 + (Level × 15)            // +15 per level
baseCrit = 5%                          // Base critical chance
```

### Buffed Stats (After Equipment/Set Bonuses)
```
playerAttack = floor(baseAttack × (1 + attack_buff))
playerDefense = floor(baseDefense × (1 + defense_buff))
playerHp = floor((baseHp + hpFlat) × (1 + hpPercent))
playerCrit = baseCrit + critChance_buff
```

### Example (Level 10 Player)
- baseAttack: 25 + 20 = **45**
- baseDefense: 12 + 10 = **22**
- baseHp: 250 + 150 = **400**

With 20% attack buff: 45 × 1.2 = **54 attack**

---

## 💥 DAMAGE CALCULATION

### The League of Legends Armor Formula
Used for ALL damage calculations (Adventure, PvP, Raid):

```javascript
damageReduction = Defense / (Defense + 100)
damage = Attack × (1 - damageReduction) × variance

Example:
- Attack: 50
- Enemy Defense: 100
- damageReduction = 100 / (100 + 100) = 0.5  (50% reduction)
- Effective Damage = 50 × 0.5 × variance = 25-30 DMG
```

### Variance (Randomness)
```
variance = 0.8 + Math.random() * 0.4
Range: 0.8 to 1.2 (±20% deviation)
```

### Minimum Damage
```
if (damage < 5) damage = 5   // Hard floor of 5 DMG
```

---

## ⚡ SPECIAL PROCS & EFFECTS

### Crushing Blow
- **Chance**: 15% + (Luck × 5%)
- **Effect**: +50% Armor value as bonus damage
- **Calculation**: bonusDamage = floor(enemyDefense × 0.5 × variance)
- **Logic**: Ignores half the enemy's defense effectiveness

### Fury (Double Attack)
- **Chance**: 20% + (Luck × 3%)
- **Effect**: Attack twice in one turn
- **Second Attack**: 60% damage of first attack

### Lifesteal
- **Chance**: 10% + (Luck × 3%)
- **Effect**: Heal 30% of damage dealt
- **Capped**: Can't exceed max HP

### Stun
- **Chance**: 5% + (Luck × 2%)
- **Effect**: Skip opponent's next turn
- **Duration**: 1 turn only

### Critical Hit
- **Base Chance**: 5% + (Crit Buff)
- **Damage**: Multiply by (1 + CritDMG%)
- **Example**: 50 base DMG with 100% CritDMG = 100 DMG crit

---

## 🛡️ DODGE & COUNTER-ATTACK

### Dodge Chance
```
dodge = min(5% + (Luck × 10%), 30%)
Max: 30% dodge (capped)
```

### Counter-Attack Chance  
```
counter = min(10% + (Luck × 5%), 25%)
Max: 25% counter (capped)
Damage: 50% of normal attack
```

### Luck Scaling
- **Dodge**: 10% per luck point (5% base)
- **Counter**: 5% per luck point (10% base)
- **All Procs**: Small increases (+2-5% per proc type)
- **Why Luck?**: Designed for defensive/utility builds

---

## 🌈 ELEMENTAL REACTIONS & DUAL MASTERY (3+3)

### Trigger Conditions
- Exactly **two different elements** detected across equipped sets
- **3+ pieces** of each element (3+3 split)
- Reaction must be **enabled** in toggles

### Key Normalization (IMPORTANT)
Reaction lookups use **alphabetically sorted keys**:
```
getReactionKey(elem1, elem2) = [elem1, elem2].sort().join('-')
```
All reaction and mastery definitions are now stored using **sorted keys** (e.g., `hydro-pyro` not `pyro-hydro`).

### Active Reaction Effects (Core)
- **Vaporize (hydro-pyro)**: 1.5x damage, 35% proc
- **Melt (cryo-pyro)**: 2.0x damage, 25% proc
- **Overload (electro-pyro)**: +75 bonus damage + 20% stun, 30% proc
- **Freeze (cryo-hydro)**: 25% stun, 25% proc
- **Superconduct (cryo-electro)**: -40% defense for 3 turns, 30% proc
- **Swirls (anemo-*)**: 15% reflect + element-specific bonus, 25% proc

### Dual Mastery Bonuses (3+3)
Applied on top of reactions for the same element pair (using sorted keys):
- **Vaporize Mastery (hydro-pyro)**: +15% ATK, +10% HP, +8% DMG
- **Melt Mastery (cryo-pyro)**: +15% ATK, +20% Crit DMG, +10% DMG
- **Overload Mastery (electro-pyro)**: +12% ATK, +5% Crit, +15 Energy
- **Freeze Mastery (cryo-hydro)**: +10% Crit, +25% Crit DMG, +10% HP
- **Superconduct Mastery (cryo-electro)**: +10% ATK, +8% Crit, +20 Energy

---

## 🎮 ADVENTURE COMBAT (PvE)

### Enemy Scaling
```javascript
Enemy Stats per Stage:
- HP: 50 + (stage × 12)
- Attack: 8 + (stage × 3)
- Defense: 3 + (stage × 1.5)

Boss Scaling (every 10 stages):
- HP: ×2.5
- Attack: ×1.5
```

### Combat Loop
1. Player attacks (can dodge, crit, proc)
2. Enemy counter-attacks if alive
3. Loop until one dies
4. Max 50 stages per adventure

### Rewards
```
Base Loot: 2000-5000
Multiplier: 1 + (stagesCleared - 1) × 0.05
Maximum: ~3.45x at stage 50

Loot Calculation:
finalLoot = floor(baseLoot × multiplier × lootBoost) + chestBonuses

XP:
baseXP = 20 + (stagesCleared × 500)
finalXP = floor((baseXP + bonus) × (1 + xpBoost))
```

---

## ⚔️ PvP DUEL COMBAT

### Stat Initialization
Same formulas as Adventure, but:
- Both players start at max HP
- HP bars update in real-time
- Combat phases affect mechanics

### Combat Phases
```
OPENING STRIKE (Turns 1-3):
- +50% Crit Chance
- Used for burst damage

DESPERATE (HP < 30%):
- +30% Damage
- +15% Dodge Bonus
- Both players can trigger
```

### Turn Order
- Challenger attacks first
- Then opponent attacks
- Repeat until one dies (max 50 turns)

---

## 🐉 RAID BOSS SCALING

### Boss Stats Calculation
Bosses scale dynamically based on **all players** in the database:

```javascript
// Calculate average across all players
avgPlayerDamage = average damage per turn across all players
avgPlayerDefense = average defense
avgPlayerHp = average HP
playerCount = total players

// Boss HP scales heavily
maxHp = 10,000 + (playerCount × avgDamage × 50)

// Boss Attack to kill player in ~5 turns
targetDamagePerTurn = avgPlayerHp / 5
bossAttack = adjusted for dodge & defense
minAttack = avgDamage × 1.8  // Never below 1.8x avg player damage

// Boss Defense
bossDefense = floor((avgLevel × 1.5) + 12)
```

### Example Calculation
```
Player Base: 5 players
- avgDamage: 20/turn
- avgDefense: 25
- avgHp: 500
- avgLevel: 5

Boss Stats:
- maxHp = 10,000 + (5 × 20 × 50) = 15,000 HP
- bossAttack ≈ 150+ (to threaten in 5 turns)
- bossDefense = floor(7.5 + 12) = 19
```

### Boss Difficulty Scaling
- **Few players**: Low HP, weak boss
- **Many players**: High HP, strong boss
- **Damage-heavy players**: More boss HP
- **Goal**: Teamwork required, solo unkillable

---

## 💰 RAID REWARDS

### Money Distribution
```javascript
baseReward = 50,000 (guaranteed)
moneyPool = raidBoss.maxHp × 10

damagePercent = playerDamage / totalDamage
poolReward = floor(moneyPool × damagePercent)

totalReward = baseReward + poolReward
```

### XP Reward
```
xpReward = raidBoss.maxHp  // Same as boss HP!
```

### Item Drop (Based on Placement)
```
#1: Legendary (guaranteed)
#2: 50/50 Legendary or Epic
#3: Epic (guaranteed)
#4-5: 30% Epic, 70% Rare
#6-10: Rare (guaranteed)
#11+: 25% Rare, 75% Uncommon, nothing (50%)
```

---

## 🎯 CRITICAL ISSUES & FIXES

### Issue 1: Race Conditions (FIXED ✅)
- **Problem**: Multiple simultaneous attacks caused duplicate rewards
- **Fix**: 
  - Atomic HP update with `$inc`
  - Atomic leaderboard with aggregation pipeline
  - Single player marks boss defeated (only one distributes rewards)
  - Re-fetch participants before reward loop

### Issue 2: Leaderboard Sorting (FIXED ✅)
- **Problem**: Players appeared out of order on leaderboard
- **Fix**: 
  - Changed `$in` operator to `$anyElementTrue` with `$map`
  - Added `$sortArray` in aggregation pipeline
  - Leaderboard now sorted in DB immediately

### Issue 3: Boss Stats Calculation Performance (FIXED ✅)
- **Problem**: 10x duplicate expensive queries on simultaneous raids
- **Fix**: 
  - `getCachedBossStats()` with 5-second TTL
  - Lock mechanism prevents simultaneous calculations
  - Polling mechanism for waiting requests

### Issue 4: XP Not Processing on Level-Up (FIXED ✅)
- **Problem**: Raid XP awarded but no level-up triggered
- **Fix**:
  - Added `handleLevelUp()` call after raid rewards
  - Profile auto-levels on `/profile` view
  - Excess XP carries over correctly

### Issue 5: Reactions Not Triggering (FIXED ✅)
- **Problem**: Element pairs were built in different orders, causing key mismatches
- **Fix**:
  - Normalize reaction keys with alphabetical sort
  - Update all reaction + mastery definitions to sorted keys

### Issue 6: Mixed Sets Not Detected (FIXED ✅)
- **Problem**: Older items lacked `element` property, so reactions never activated
- **Fix**:
  - Startup backfill assigns elements based on `setName`
  - Ensures 3+3 detection works for legacy items

---

## 📊 STAT GROWTH PROGRESSION

### Per Level
```
Attack: +2
Defense: +1
HP: +15
```

### Level-Up Buff Bonus
```
Each buff increases by +0.1 on level up:
- attackBoost
- defenseBoost  
- criticalChance
- healingBoost
- xpBoost
- etc.
```

### XP Required per Level
```
xpForLevel = floor(100 × Level^1.5)

Level 1: 100 XP
Level 5: 745 XP
Level 10: 3,162 XP
Level 20: 17,889 XP
```

---

## 🔍 FORMULAS REFERENCE

| Component | Formula |
|-----------|---------|
| Effective Damage | `Attack × (1 - Defense/(Defense+100)) × Variance` |
| Crit Damage | `Damage × (1 + CritDMG%)` |
| Crushing Blow | `+50% of Defense × Variance` |
| Fury Damage | `Damage × 0.6` (second attack) |
| Lifesteal | `Heal 30% of damage dealt` |
| Dodge Chance | `5% + (Luck × 10%), capped 30%` |
| Counter Chance | `10% + (Luck × 5%), capped 25%` |
| HP | `(250 + Level×15 + HPFlat) × (1 + HPPercent)` |
| Attack | `(25 + Level×2 + ATKFlat) × (1 + ATKPercent)` |

---

## 🎲 RANDOMNESS SOURCES

1. **Variance** (±20%): Every damage roll
2. **Crit Roll**: 5% base + buffs
3. **Proc Rolls**: Crushing Blow, Fury, Lifesteal, Stun
4. **Dodge Roll**: Each attack
5. **Counter Roll**: Each attack taken
6. **Enemy Selection**: Random from 8 types
7. **Item Drops**: Based on rarity + slot + set

---

## ✅ VALIDATION CHECKLIST

- [ ] All players at end of raid cycle get correct rewards
- [ ] Items awarded match placement tiers
- [ ] Leaderboard sorted correctly by damage
- [ ] XP causes level-ups immediately or on `/profile` view
- [ ] Boss HP scales with player count & damage
- [ ] Damage formula applies defense reduction correctly
- [ ] No duplicate rewards for same player
- [ ] Cooldown system working (hourly reset)
- [ ] 3+3 reactions and dual mastery show in profile/loadout
