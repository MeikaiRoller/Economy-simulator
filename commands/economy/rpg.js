const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Cooldown = require("../../schema/Cooldown");
const Item = require("../../schema/Item");
const RaidBoss = require("../../schema/RaidBoss");
const calculateActiveBuffs = require("../../utils/calculateBuffs");
const { default: prettyMs } = require("pretty-ms");
const { generateItem, rollRarity } = require("../../utils/generateItem");

// Store active duel challenges (in-memory)
const activeChallenges = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rpg")
    .setDescription("RPG adventure commands")
    .addSubcommand((sub) =>
      sub
        .setName("adventure")
        .setDescription("Embark on a Nether adventure to fight enemies, find loot, and discover items!")
    )
    .addSubcommand((sub) =>
      sub
        .setName("duel")
        .setDescription("Challenge another player to a PVP duel with a wager")
        .addUserOption((opt) =>
          opt
            .setName("opponent")
            .setDescription("The player you want to challenge")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("wager")
            .setDescription("Gold amount to wager (min: $1,000, max: $50,000)")
            .setRequired(true)
            .setMinValue(1000)
            .setMaxValue(50000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("View your character stats and level")
    )
    .addSubcommand((sub) =>
      sub
        .setName("raid")
        .setDescription("Fight the raid boss with global health (refreshes every 2 hours)")
    ),

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only use RPG commands inside a server!",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "adventure") {
      return handleAdventure(interaction);
    } else if (subcommand === "duel") {
      return handleDuel(interaction);
    } else if (subcommand === "stats") {
      return handleStats(interaction);
    } else if (subcommand === "raid") {
      return handleRaid(interaction);
    }
  },
};

async function handleAdventure(interaction) {
  try {
    await interaction.deferReply();
  } catch (error) {
    console.error('Failed to defer reply:', error.message);
    return; // Interaction expired, can't respond
  }

  const userId = interaction.user.id;
  let userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return interaction.editReply({
      content: "❌ You need to create a profile first using `/create-profile`!",
    });
  }

  const commandName = "adventure";
  let cooldown = await Cooldown.findOne({ userId, commandName });

  if (cooldown && Date.now() < cooldown.endsAt) {
    return interaction.editReply({
      content: `⏳ You're still resting after your last adventure! Try again in **${prettyMs(
        cooldown.endsAt - Date.now()
      )}**.`,
    });
  }

  if (!cooldown) {
    cooldown = new Cooldown({ userId, commandName });
  }

  // Calculate Active Buffs
  const activeBuffs = await calculateActiveBuffs(userProfile);

  // Base Stats (scaled with level)
  const baseAttack = 25 + (userProfile.level * 2); // +2 attack per level
  const baseDefense = 12 + userProfile.level; // +1 defense per level
  const baseCritChance = 5;

  // Buffed Player Stats
  const playerAttack = Math.floor(baseAttack * (1 + activeBuffs.attack));
  const playerDefense = Math.floor(baseDefense * (1 + activeBuffs.defense));
  const playerCrit = baseCritChance + activeBuffs.critChance;
  const playerXpBoost = activeBuffs.xpBoost || 0;
  const playerLootBoost = activeBuffs.lootBoost || 0;

  // Apply cooldown reduction
  let baseCooldown = 1 * 60 * 60 * 1000; // 1 hour
  if (activeBuffs.cooldownReduction) {
    const reduction = Math.min(activeBuffs.cooldownReduction, 80);
    baseCooldown = Math.floor(baseCooldown * (1 - reduction / 100));
  }
  
  // Mudae-style hourly reset: reset at the top of the next hour
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  cooldown.endsAt = nextHour;
  await cooldown.save();

  // Adventure Begins
  let playerCurrentHp = 250;
  let currentStage = 1;
  const maxStages = 50;
  let stagesCleared = 0;
  let criticalHits = 0;
  let bossesDefeated = 0;
  let itemsFound = [];
  let treasureChestsFound = 0;
  let bonusGoldFromChests = 0;

  while (currentStage <= maxStages) {
    // Check for treasure chest encounter (5% chance on non-boss stages)
    const isBoss = currentStage % 10 === 0;
    const treasureChance = isBoss ? 0 : 0.05;
    
    if (Math.random() < treasureChance) {
      treasureChestsFound++;
      
      // Treasure chest rewards
      const chestGold = Math.floor(Math.random() * 4000) + 2000 + (currentStage * 200);
      bonusGoldFromChests += chestGold;
      
      // Guaranteed item drop from chest
      const chestItem = await rollItemDrop(currentStage, false);
      if (chestItem) {
        itemsFound.push(chestItem);
        const existingItem = userProfile.inventory.find(i => i.itemId === chestItem.itemId);
        if (existingItem) {
          existingItem.quantity++;
        } else {
          userProfile.inventory.push({ itemId: chestItem.itemId, quantity: 1 });
        }
      }
      
      stagesCleared++;
      currentStage++;
      continue;
    }
    
    const enemy = generateEnemy(currentStage);
    let enemyHp = enemy.maxHp;

    // Check for boss encounter
    if (isBoss) {
      enemy.maxHp = Math.floor(enemy.maxHp * 2.5);
      enemy.attack = Math.floor(enemy.attack * 1.5);
      enemy.name = `💀 ${enemy.name} (BOSS)`;
      enemyHp = enemy.maxHp;
    }

    // Fight simulation
    while (playerCurrentHp > 0 && enemyHp > 0) {
      // Player attacks
      let damage = playerAttack - enemy.defense;
      if (Math.random() * 100 < playerCrit) {
        damage *= 2; // Critical hit
        criticalHits++;
      }
      if (damage < 5) damage = 5; // minimum damage
      enemyHp -= damage;

      if (enemyHp <= 0) break;

      // Enemy attacks
      let enemyDamage = enemy.attack - playerDefense;
      if (enemyDamage < 5) enemyDamage = 5;
      playerCurrentHp -= enemyDamage;
    }

    if (playerCurrentHp <= 0) break;

    stagesCleared++;
    if (isBoss) bossesDefeated++;
    
    // Item drop chance (higher for bosses)
    const dropChance = isBoss ? 0.25 : 0.05; // 25% boss, 5% normal
    const findRateBonus = activeBuffs.findRateBoost || 0;
    const finalDropChance = Math.min(dropChance * (1 + findRateBonus), 0.5);
    
    if (Math.random() < finalDropChance) {
      const droppedItem = await rollItemDrop(currentStage, isBoss);
      if (droppedItem) {
        itemsFound.push(droppedItem);
        
        // Add to inventory
        const existingItem = userProfile.inventory.find(i => i.itemId === droppedItem.itemId);
        if (existingItem) {
          existingItem.quantity++;
        } else {
          userProfile.inventory.push({ itemId: droppedItem.itemId, quantity: 1 });
        }
      }
    }
    
    currentStage++;
  }

  // Calculate rewards
  const baseLoot = Math.floor(Math.random() * 3000) + 2000; // 2000-5000
  const lootMultiplier = 1 + (stagesCleared - 1) * 0.05; // Scales to ~3.45x max at stage 50
  const finalLoot = Math.floor(baseLoot * lootMultiplier * playerLootBoost) + bonusGoldFromChests;

  const baseXP = 20 + stagesCleared * 500;
  const randomBonusXP = Math.floor(Math.random() * 10);
  const finalXP = Math.floor((baseXP + randomBonusXP) * (1 + playerXpBoost));

  userProfile.balance += finalLoot;
  userProfile.xp += finalXP;

  const leveledUp = await handleLevelUp(userProfile);
  
  // Reset HP to max after adventure
  const updatedBuffs = await calculateActiveBuffs(userProfile);
  const maxHp = Math.floor((250 + userProfile.level * 15 + (updatedBuffs.hpFlat || 0)) * (1 + (updatedBuffs.hpPercent || 0)));
  userProfile.hp = maxHp;
  
  await userProfile.save();

  // Build item drops string
  let itemDropsText = "None";
  if (itemsFound.length > 0) {
    const itemCounts = {};
    itemsFound.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    });
    itemDropsText = Object.entries(itemCounts)
      .map(([name, count]) => {
        const item = itemsFound.find(i => i.name === name);
        return `${item.emoji} **${name}** x${count}`;
      })
      .join("\n");
  }

  // Build summary embed
  const resultEmbed = new EmbedBuilder()
    .setTitle("🌌 Nether Adventure Complete")
    .setDescription("🏹 You ventured deep into the Nether!")
    .addFields(
      { name: "Stages Cleared", value: `${stagesCleared}/50`, inline: true },
      { name: "Level", value: `${userProfile.level}`, inline: true },
      { name: "⚔️ Critical Hits", value: `${criticalHits}`, inline: true },
      { name: "💀 Bosses Defeated", value: `${bossesDefeated}`, inline: true },
      { name: "📦 Treasure Chests", value: `${treasureChestsFound}`, inline: true },
      { name: "🪙 Bonus Gold", value: `$${bonusGoldFromChests.toLocaleString()}`, inline: true },
      {
        name: "💰 Total Loot",
        value: `$${finalLoot.toLocaleString()}`,
        inline: true,
      },
      {
        name: "📈 XP Gained",
        value: `${finalXP.toLocaleString()} XP`,
        inline: true,
      },
      {
        name: "🎁 Items Found",
        value: itemDropsText,
        inline: false,
      }
    )
    .setColor(stagesCleared >= 40 ? 0xffd700 : stagesCleared >= 25 ? 0x00ff00 : 0x2f3136)
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed] });

  if (leveledUp) {
    const levelUpEmbed = new EmbedBuilder()
      .setTitle("🎉 Level Up!")
      .setDescription(`You reached **Level ${userProfile.level}**! Your strength has grown!`)
      .setColor(0x00ffcc)
      .setTimestamp();

    await interaction.followUp({ embeds: [levelUpEmbed] });
  }
}

async function handleStats(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    return interaction.editReply({
      content: "❌ You need to create a profile first using `/create-profile`!",
    });
  }

  const xpToNextLevel = calculateXPForLevel(userProfile.level);
  const xpProgress = ((userProfile.xp / xpToNextLevel) * 100).toFixed(1);

  const statsEmbed = new EmbedBuilder()
    .setTitle(`⚔️ ${interaction.user.username}'s Stats`)
    .addFields(
      { name: "Level", value: `${userProfile.level}`, inline: true },
      { name: "Experience", value: `${userProfile.xp} / ${xpToNextLevel}`, inline: true },
      { name: "Progress", value: `${xpProgress}%`, inline: true },
      { name: "💰 Balance", value: `$${userProfile.balance.toLocaleString()}`, inline: true }
    )
    .setColor(0x3498db)
    .setTimestamp();

  await interaction.editReply({ embeds: [statsEmbed] });
}

function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

async function handleLevelUp(userProfile) {
  let leveledUp = false;
  while (userProfile.xp >= calculateXPForLevel(userProfile.level)) {
    userProfile.xp -= calculateXPForLevel(userProfile.level);
    userProfile.level += 1;
    leveledUp = true;

    userProfile.buffs.attackBoost += 0.1;
    userProfile.buffs.defenseBoost += 0.1;
    userProfile.buffs.magicBoost += 0.1;
    userProfile.buffs.magicDefenseBoost += 0.1;
    userProfile.buffs.criticalChance += 0.1;
    userProfile.buffs.healingBoost += 0.1;
    userProfile.buffs.xpBoost += 0.1;
  }
  if (leveledUp) {
    await userProfile.save();
  }
  return leveledUp;
}

function generateEnemy(stage) {
  const enemyTypes = [
    "Zombie Pigman",
    "Blaze",
    "Ghast",
    "Magma Cube",
    "Wither Skeleton",
    "Nether Wraith",
    "Lava Demon",
    "Soul Reaper",
  ];
  
  const enemyName = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  
  return {
    name: enemyName,
    maxHp: 50 + stage * 12, // Reduced from 20 to 12
    attack: 8 + stage * 3, // Reduced from 10 + 5*stage to 8 + 3*stage
    defense: 3 + stage * 1.5, // Reduced from 5 + 3*stage to 3 + 1.5*stage
  };
}

// Roll for item drops based on stage and encounter type
async function rollItemDrop(stage, isBoss) {
  // Use procedural generation for item drops
  const rarity = rollRarity(isBoss);
  
  // Randomly select slot
  const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'accessory'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  
  // Randomly select set (or null for no set)
  const sets = [
    'Ethans Prowess',
    'Olivias Fury',
    'Justins Clapping',
    'Lilahs Cold Heart',
    'Hasagi',
    'Maries Zhongli Bodypillow',
    'Andys Soraka',
    null // 12.5% chance for non-set item
  ];
  const setName = sets[Math.floor(Math.random() * sets.length)];
  
  // Generate the item
  const itemData = generateItem(slot, rarity, setName);
  
  // Check if item already exists in database
  let existingItem = await Item.findOne({ itemId: itemData.itemId });
  
  // Only save if it doesn't exist yet
  if (!existingItem) {
    const newItem = new Item({
      itemId: itemData.itemId,
      name: itemData.name,
      description: itemData.description,
      emoji: itemData.emoji,
      slot: itemData.slot,
      setName: itemData.setName,
      element: itemData.element,
      mainStat: itemData.mainStat,
      subStats: itemData.subStats,
      rarity: itemData.rarity,
      price: itemData.price,
      shopPrice: itemData.shopPrice
    });
    
    try {
      await newItem.save();
    } catch (error) {
      // Ignore duplicate key errors
      if (error.code !== 11000) {
        console.error('Error saving item:', error);
      }
    }
  }
  
  return {
    itemId: itemData.itemId,
    name: itemData.name,
    emoji: itemData.emoji,
    rarity: itemData.rarity,
    setName: itemData.setName,
    element: itemData.element
  };
}

async function handleDuel(interaction) {
  await interaction.deferReply();

  const challenger = interaction.user;
  const opponent = interaction.options.getUser("opponent");
  const wager = interaction.options.getInteger("wager");

  // Validations
  if (opponent.id === challenger.id) {
    return interaction.editReply("❌ You can't challenge yourself to a duel!");
  }

  if (opponent.bot) {
    return interaction.editReply("❌ You can't challenge bots to duels!");
  }

  // Check if profiles exist
  const challengerProfile = await UserProfile.findOne({ userId: challenger.id });
  const opponentProfile = await UserProfile.findOne({ userId: opponent.id });

  if (!challengerProfile) {
    return interaction.editReply("❌ You need to create a profile first using `/create-profile`!");
  }

  if (!opponentProfile) {
    return interaction.editReply(`❌ ${opponent.username} doesn't have a profile yet!`);
  }

  // Check balances
  if (challengerProfile.balance < wager) {
    return interaction.editReply(`❌ You need $${(wager - challengerProfile.balance).toLocaleString()} more to wager this amount!`);
  }

  if (opponentProfile.balance < wager) {
    return interaction.editReply(`❌ ${opponent.username} doesn't have enough balance to match this wager!`);
  }

  // Create challenge embed with buttons
  const challengeEmbed = new EmbedBuilder()
    .setTitle("⚔️ PVP Duel Challenge!")
    .setDescription(`${challenger} has challenged ${opponent} to a duel!`)
    .addFields(
      { name: "💰 Wager", value: `$${wager.toLocaleString()}`, inline: true },
      { name: "🏆 Winner Takes", value: `$${(wager * 2).toLocaleString()}`, inline: true },
      { name: "⏰ Expires", value: "<t:" + Math.floor((Date.now() + 120000) / 1000) + ":R>", inline: true }
    )
    .setColor(0xff0000)
    .setTimestamp();

  const acceptButton = new ButtonBuilder()
    .setCustomId("duel_accept")
    .setLabel("⚔️ Accept Duel")
    .setStyle(ButtonStyle.Success);

  const declineButton = new ButtonBuilder()
    .setCustomId("duel_decline")
    .setLabel("❌ Decline")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

  const message = await interaction.editReply({ embeds: [challengeEmbed], components: [row] });

  // Store challenge data
  const challengeId = `${challenger.id}-${opponent.id}-${Date.now()}`;
  activeChallenges.set(challengeId, {
    challengerId: challenger.id,
    opponentId: opponent.id,
    wager,
    messageId: message.id,
    expiresAt: Date.now() + 120000 // 2 minutes
  });

  // Create button collector
  const collector = message.createMessageComponentCollector({
    time: 120000 // 2 minutes
  });

  collector.on("collect", async (buttonInteraction) => {
    // Only opponent can interact
    if (buttonInteraction.user.id !== opponent.id) {
      return buttonInteraction.reply({
        content: "❌ This challenge is not for you!",
        ephemeral: true
      });
    }

    if (buttonInteraction.customId === "duel_decline") {
      activeChallenges.delete(challengeId);
      await buttonInteraction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚔️ Duel Declined")
            .setDescription(`${opponent} has declined the duel challenge.`)
            .setColor(0x808080)
        ],
        components: []
      });
      collector.stop();
      return;
    }

    if (buttonInteraction.customId === "duel_accept") {
      // Re-verify balances
      const freshChallenger = await UserProfile.findOne({ userId: challenger.id });
      const freshOpponent = await UserProfile.findOne({ userId: opponent.id });

      if (freshChallenger.balance < wager || freshOpponent.balance < wager) {
        activeChallenges.delete(challengeId);
        await buttonInteraction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚔️ Duel Cancelled")
              .setDescription("One of the players no longer has enough balance!")
              .setColor(0xff0000)
          ],
          components: []
        });
        collector.stop();
        return;
      }

      // Start combat!
      await buttonInteraction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚔️ Duel Starting!")
            .setDescription("⏳ Preparing for battle...")
            .setColor(0xffaa00)
        ],
        components: []
      });

      // Simulate combat with real-time updates
      const combatResult = await simulatePvPCombatRealTime(freshChallenger, freshOpponent, challenger, opponent, buttonInteraction);

      // Determine winner
      const winnerId = combatResult.winner === "challenger" ? challenger.id : opponent.id;
      const loserId = combatResult.winner === "challenger" ? opponent.id : challenger.id;
      const winnerUser = combatResult.winner === "challenger" ? challenger : opponent;
      const loserUser = combatResult.winner === "challenger" ? opponent : challenger;

      // Update balances and stats
      const winnerProfile = await UserProfile.findOne({ userId: winnerId });
      const loserProfile = await UserProfile.findOne({ userId: loserId });

      winnerProfile.balance += wager;
      loserProfile.balance -= wager;

      // Initialize pvpStats if not exists
      if (!winnerProfile.pvpStats) winnerProfile.pvpStats = { wins: 0, losses: 0, totalWagered: 0, totalWon: 0, totalLost: 0 };
      if (!loserProfile.pvpStats) loserProfile.pvpStats = { wins: 0, losses: 0, totalWagered: 0, totalWon: 0, totalLost: 0 };

      winnerProfile.pvpStats.wins++;
      winnerProfile.pvpStats.totalWagered += wager;
      winnerProfile.pvpStats.totalWon += wager;

      loserProfile.pvpStats.losses++;
      loserProfile.pvpStats.totalWagered += wager;
      loserProfile.pvpStats.totalLost += wager;

      // Reset both players' HP to max after duel
      const winnerBuffs = await calculateActiveBuffs(winnerProfile);
      const loserBuffs = await calculateActiveBuffs(loserProfile);
      
      const winnerMaxHp = Math.floor((250 + winnerProfile.level * 15 + (winnerBuffs.hpFlat || 0)) * (1 + (winnerBuffs.hpPercent || 0)));
      const loserMaxHp = Math.floor((250 + loserProfile.level * 15 + (loserBuffs.hpFlat || 0)) * (1 + (loserBuffs.hpPercent || 0)));
      
      winnerProfile.hp = winnerMaxHp;
      loserProfile.hp = loserMaxHp;

      await winnerProfile.save();
      await loserProfile.save();

      // Build result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle("⚔️ Duel Complete!")
        .setDescription(`🏆 **${winnerUser}** defeated **${loserUser}**!`)
        .addFields(
          { name: "🏆 Winner", value: `${winnerUser}`, inline: true },
          { name: "💀 Defeated", value: `${loserUser}`, inline: true },
          { name: "💰 Prize", value: `$${wager.toLocaleString()}`, inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await buttonInteraction.editReply({ embeds: [resultEmbed] });

      activeChallenges.delete(challengeId);
      collector.stop();
    }
  });

  collector.on("end", async () => {
    if (activeChallenges.has(challengeId)) {
      activeChallenges.delete(challengeId);
      try {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚔️ Duel Expired")
              .setDescription("The challenge was not accepted in time.")
              .setColor(0x808080)
          ],
          components: []
        });
      } catch (e) {
        // Message might be deleted
      }
    }
  });
}

async function simulatePvPCombat(challengerProfile, opponentProfile, challengerUser, opponentUser) {
  // Calculate stats for both players
  const challengerBuffs = await calculateActiveBuffs(challengerProfile);
  const opponentBuffs = await calculateActiveBuffs(opponentProfile);

  // Base stats with flat bonuses
  const challengerAttack = Math.floor((25 + challengerProfile.level * 2 + (challengerBuffs.attackFlat || 0)) * (1 + challengerBuffs.attack));
  const challengerDefense = Math.floor((12 + challengerProfile.level + (challengerBuffs.defenseFlat || 0)) * (1 + challengerBuffs.defense));
  const challengerCrit = 5 + challengerBuffs.critChance;
  const challengerCritDMG = 100 + (challengerBuffs.critDMG || 0);
  const challengerLuck = challengerBuffs.luck || 0;
  let challengerHp = Math.floor((250 + challengerProfile.level * 15 + (challengerBuffs.hpFlat || 0)) * (1 + (challengerBuffs.hpPercent || 0)));

  const opponentAttack = Math.floor((25 + opponentProfile.level * 2 + (opponentBuffs.attackFlat || 0)) * (1 + opponentBuffs.attack));
  const opponentDefense = Math.floor((12 + opponentProfile.level + (opponentBuffs.defenseFlat || 0)) * (1 + opponentBuffs.defense));
  const opponentCrit = 5 + opponentBuffs.critChance;
  const opponentCritDMG = 100 + (opponentBuffs.critDMG || 0);
  const opponentLuck = opponentBuffs.luck || 0;
  let opponentHp = Math.floor((250 + opponentProfile.level * 15 + (opponentBuffs.hpFlat || 0)) * (1 + (opponentBuffs.hpPercent || 0)));

  const maxHpChallenger = challengerHp;
  const maxHpOpponent = opponentHp;

  // Calculate dodge chance (5% base + luck bonus, max 30%)
  const challengerDodge = Math.min(5 + (challengerLuck * 10), 30);
  const opponentDodge = Math.min(5 + (opponentLuck * 10), 30);

  // Calculate counter-attack chance (10% base + luck bonus, max 25%)
  const challengerCounter = Math.min(10 + (challengerLuck * 5), 25);
  const opponentCounter = Math.min(10 + (opponentLuck * 5), 25);

  // Combat log
  let log = `**${challengerUser.username}** (Lv.${challengerProfile.level}) vs **${opponentUser.username}** (Lv.${opponentProfile.level})\n\n`;

  let turn = 0;
  const maxTurns = 50;
  let challengerStunned = false;
  let opponentStunned = false;

  while (challengerHp > 0 && opponentHp > 0 && turn < maxTurns) {
    turn++;

    // Determine combat phase
    let phaseBonus = { critBonus: 0, damageBonus: 0, dodgeBonus: 0 };
    let phaseName = "";
    
    if (turn <= 3) {
      phaseBonus = { critBonus: 50, damageBonus: 0, dodgeBonus: 0 };
      phaseName = "⚡ OPENING STRIKE";
    } else if (challengerHp < maxHpChallenger * 0.3 || opponentHp < maxHpOpponent * 0.3) {
      phaseBonus = { critBonus: 0, damageBonus: 30, dodgeBonus: 15 };
      phaseName = "🔥 DESPERATE";
    }

    if (phaseName && turn === 1) {
      log += `**${phaseName} Phase!**\n\n`;
    } else if (phaseName === "🔥 DESPERATE" && turn > 3 && (challengerHp < maxHpChallenger * 0.3 || opponentHp < maxHpOpponent * 0.3)) {
      const desperatePlayer = challengerHp < maxHpChallenger * 0.3 ? challengerUser.username : opponentUser.username;
      if (!log.includes("🔥 DESPERATE Phase!")) {
        log += `\n**🔥 DESPERATE Phase! ${desperatePlayer} fights for survival!**\n\n`;
      }
    }

    // CHALLENGER'S TURN
    if (!challengerStunned) {
      // Check dodge
      const challengerDodgeChance = opponentDodge + (opponentHp < maxHpOpponent * 0.3 ? phaseBonus.dodgeBonus : 0);
      if (Math.random() * 100 < challengerDodgeChance) {
        log += `💨 **${opponentUser.username}** dodged the attack!\n`;
      } else {
        // Calculate damage using LoL armor formula
        const variance = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
        const damageReduction = opponentDefense / (opponentDefense + 100);
        let damage = Math.floor(challengerAttack * (1 - damageReduction) * variance);
        if (damage < 1) damage = 1;

        // Apply phase damage bonus
        if (challengerHp < maxHpChallenger * 0.3) {
          damage = Math.floor(damage * (1 + phaseBonus.damageBonus / 100));
        }

        // Check for crit
        const critChance = challengerCrit + (turn <= 3 ? phaseBonus.critBonus : 0);
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) damage = Math.floor(damage * (1 + challengerCritDMG / 100));

        // Check for special procs
        let procMessages = [];
        
        // Crushing Blow (15% chance: ignore 50% defense)
        if (Math.random() * 100 < (15 + challengerLuck * 5)) {
          const bonusDamage = Math.floor(opponentDefense * 0.5 * variance);
          damage += bonusDamage;
          procMessages.push("💥 CRUSHING BLOW");
        }

        // Fury (20% chance: attack twice - second attack coming)
        const furyProc = Math.random() * 100 < (20 + challengerLuck * 3);
        if (furyProc) {
          procMessages.push("⚡ FURY");
        }

        // Lifesteal (10% chance: heal for 30% damage)
        if (Math.random() * 100 < (10 + challengerLuck * 3)) {
          const heal = Math.floor(damage * 0.3);
          challengerHp = Math.min(challengerHp + heal, maxHpChallenger);
          procMessages.push(`💚 LIFESTEAL (+${heal} HP)`);
        }

        // Stun (5% chance: opponent skips next turn)
        if (Math.random() * 100 < (5 + challengerLuck * 2)) {
          opponentStunned = true;
          procMessages.push("💫 STUN");
        }

        opponentHp -= damage;

        const procText = procMessages.length > 0 ? ` [${procMessages.join(", ")}]` : "";
        log += `⚔️ **${challengerUser.username}** attacks for **${damage}** damage${isCrit ? " (CRIT!)" : ""}${procText}! [${Math.max(0, opponentHp)}/${maxHpOpponent} HP]\n`;

        // Fury second attack
        if (furyProc && opponentHp > 0) {
          const furyReduction = opponentDefense / (opponentDefense + 100);
          let furyDamage = Math.floor(challengerAttack * (1 - furyReduction) * (0.8 + Math.random() * 0.4) * 0.6); // 60% damage
          if (furyDamage < 1) furyDamage = 1;
          opponentHp -= furyDamage;
          log += `⚡ **${challengerUser.username}** strikes again for **${furyDamage}** damage! [${Math.max(0, opponentHp)}/${maxHpOpponent} HP]\n`;
        }

        // Counter-attack check (if opponent still alive)
        if (opponentHp > 0 && Math.random() * 100 < opponentCounter) {
          const counterReduction = challengerDefense / (challengerDefense + 100);
          let counterDamage = Math.floor(opponentAttack * (1 - counterReduction) * 0.5);
          if (counterDamage < 1) counterDamage = 1;
          challengerHp -= counterDamage;
          log += `🔄 **${opponentUser.username}** counters for **${counterDamage}** damage! [${Math.max(0, challengerHp)}/${maxHpChallenger} HP]\n`;
        }
      }
    } else {
      log += `💫 **${challengerUser.username}** is stunned and cannot attack!\n`;
      challengerStunned = false;
    }

    if (opponentHp <= 0 || challengerHp <= 0) break;

    // OPPONENT'S TURN
    if (!opponentStunned) {
      // Check dodge
      const opponentDodgeChance = challengerDodge + (challengerHp < maxHpChallenger * 0.3 ? phaseBonus.dodgeBonus : 0);
      if (Math.random() * 100 < opponentDodgeChance) {
        log += `💨 **${challengerUser.username}** dodged the attack!\n`;
      } else {
        // Calculate damage using LoL armor formula
        const variance = 0.8 + (Math.random() * 0.4);
        const damageReduction = challengerDefense / (challengerDefense + 100);
        let oppDamage = Math.floor(opponentAttack * (1 - damageReduction) * variance);
        if (oppDamage < 1) oppDamage = 1;

        // Apply phase damage bonus
        if (opponentHp < maxHpOpponent * 0.3) {
          oppDamage = Math.floor(oppDamage * (1 + phaseBonus.damageBonus / 100));
        }

        // Check for crit
        const critChance = opponentCrit + (turn <= 3 ? phaseBonus.critBonus : 0);
        const isOppCrit = Math.random() * 100 < critChance;
        if (isOppCrit) oppDamage = Math.floor(oppDamage * (1 + opponentCritDMG / 100));

        // Check for special procs
        let procMessages = [];
        
        // Crushing Blow
        if (Math.random() * 100 < (15 + opponentLuck * 5)) {
          const bonusDamage = Math.floor(challengerDefense * 0.5 * variance);
          oppDamage += bonusDamage;
          procMessages.push("💥 CRUSHING BLOW");
        }

        // Fury
        const furyProc = Math.random() * 100 < (20 + opponentLuck * 3);
        if (furyProc) {
          procMessages.push("⚡ FURY");
        }

        // Lifesteal
        if (Math.random() * 100 < (10 + opponentLuck * 3)) {
          const heal = Math.floor(oppDamage * 0.3);
          opponentHp = Math.min(opponentHp + heal, maxHpOpponent);
          procMessages.push(`💚 LIFESTEAL (+${heal} HP)`);
        }

        // Stun
        if (Math.random() * 100 < (5 + opponentLuck * 2)) {
          challengerStunned = true;
          procMessages.push("💫 STUN");
        }

        challengerHp -= oppDamage;

        const procText = procMessages.length > 0 ? ` [${procMessages.join(", ")}]` : "";
        log += `⚔️ **${opponentUser.username}** attacks for **${oppDamage}** damage${isOppCrit ? " (CRIT!)" : ""}${procText}! [${Math.max(0, challengerHp)}/${maxHpChallenger} HP]\n`;

        // Fury second attack
        if (furyProc && challengerHp > 0) {
          const furyReduction = challengerDefense / (challengerDefense + 100);
          let furyDamage = Math.floor(opponentAttack * (1 - furyReduction) * (0.8 + Math.random() * 0.4) * 0.6);
          if (furyDamage < 1) furyDamage = 1;
          challengerHp -= furyDamage;
          log += `⚡ **${opponentUser.username}** strikes again for **${furyDamage}** damage! [${Math.max(0, challengerHp)}/${maxHpChallenger} HP]\n`;
        }

        // Counter-attack check
        if (challengerHp > 0 && Math.random() * 100 < challengerCounter) {
          const counterReduction = opponentDefense / (opponentDefense + 100);
          let counterDamage = Math.floor(challengerAttack * (1 - counterReduction) * 0.5);
          if (counterDamage < 1) counterDamage = 1;
          opponentHp -= counterDamage;
          log += `🔄 **${challengerUser.username}** counters for **${counterDamage}** damage! [${Math.max(0, opponentHp)}/${maxHpOpponent} HP]\n`;
        }
      }
    } else {
      log += `💫 **${opponentUser.username}** is stunned and cannot attack!\n`;
      opponentStunned = false;
    }

    if (challengerHp <= 0 || opponentHp <= 0) break;

    // Add spacing every 4 turns for readability
    if (turn % 4 === 0) log += "\n";
  }

  const winner = challengerHp > opponentHp ? "challenger" : "opponent";
  log += `\n🏆 **${winner === "challenger" ? challengerUser.username : opponentUser.username} wins!**`;

  return { winner, log };
}

async function simulatePvPCombatRealTime(challengerProfile, opponentProfile, challengerUser, opponentUser, interaction) {
  // Calculate stats for both players
  const challengerBuffs = await calculateActiveBuffs(challengerProfile);
  const opponentBuffs = await calculateActiveBuffs(opponentProfile);

  // Base stats with flat bonuses
  const challengerAttack = Math.floor((25 + challengerProfile.level * 2 + (challengerBuffs.attackFlat || 0)) * (1 + challengerBuffs.attack));
  const challengerDefense = Math.floor((12 + challengerProfile.level + (challengerBuffs.defenseFlat || 0)) * (1 + challengerBuffs.defense));
  const challengerCrit = 5 + challengerBuffs.critChance;
  const challengerCritDMG = 100 + (challengerBuffs.critDMG || 0);
  const challengerLuck = challengerBuffs.luck || 0;
  let challengerHp = Math.floor((250 + challengerProfile.level * 15 + (challengerBuffs.hpFlat || 0)) * (1 + (challengerBuffs.hpPercent || 0)));

  const opponentAttack = Math.floor((25 + opponentProfile.level * 2 + (opponentBuffs.attackFlat || 0)) * (1 + opponentBuffs.attack));
  const opponentDefense = Math.floor((12 + opponentProfile.level + (opponentBuffs.defenseFlat || 0)) * (1 + opponentBuffs.defense));
  const opponentCrit = 5 + opponentBuffs.critChance;
  const opponentCritDMG = 100 + (opponentBuffs.critDMG || 0);
  const opponentLuck = opponentBuffs.luck || 0;
  let opponentHp = Math.floor((250 + opponentProfile.level * 15 + (opponentBuffs.hpFlat || 0)) * (1 + (opponentBuffs.hpPercent || 0)));

  const maxHpChallenger = challengerHp;
  const maxHpOpponent = opponentHp;

  // Calculate dodge and counter chances
  const challengerDodge = Math.min(5 + (challengerLuck * 10) + (challengerBuffs.dodge || 0), 50);
  const opponentDodge = Math.min(5 + (opponentLuck * 10) + (opponentBuffs.dodge || 0), 50);
  const challengerCounter = Math.min(10 + (challengerLuck * 5) + (challengerBuffs.counterChance * 100 || 0), 40);
  const opponentCounter = Math.min(10 + (opponentLuck * 5) + (opponentBuffs.counterChance * 100 || 0), 40);
  
  // Get elemental reaction data
  const challengerReaction = challengerBuffs.setInfo?.elementalReaction;
  const opponentReaction = opponentBuffs.setInfo?.elementalReaction;
  
  // Apply damage bonuses from sets
  const challengerDamageBonus = 1 + (challengerBuffs.damageBonus || 0);
  const opponentDamageBonus = 1 + (opponentBuffs.damageBonus || 0);

  let turn = 0;
  const maxTurns = 50;
  let challengerStunned = false;
  let opponentStunned = false;
  
  let lastChallengerAction = "";
  let lastOpponentAction = "";
  let currentPhase = "⚡ OPENING STRIKE";

  // Helper to create HP bar
  const createHpBar = (current, max) => {
    const percentage = Math.max(0, current / max);
    const filled = Math.floor(percentage * 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  // Helper to update display
  const updateDisplay = async (title, description) => {
    const challengerHpBar = createHpBar(Math.max(0, challengerHp), maxHpChallenger);
    const opponentHpBar = createHpBar(Math.max(0, opponentHp), maxHpOpponent);
    
    let display = `**${challengerUser.username}** [${challengerHpBar}] ${Math.max(0, challengerHp)}/${maxHpChallenger} HP\n`;
    display += `**${opponentUser.username}** [${opponentHpBar}] ${Math.max(0, opponentHp)}/${maxHpOpponent} HP\n\n`;
    display += `**Phase:** ${currentPhase}\n**Turn:** ${turn}\n\n`;
    display += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (lastChallengerAction) display += lastChallengerAction + '\n';
    if (lastOpponentAction) display += lastOpponentAction + '\n';
    
    if (description) display += `\n${description}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(display)
      .setColor(0xff6600)
      .setTimestamp();

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      // Ignore rate limit errors
    }
  };

  // Initial display
  await updateDisplay("⚔️ DUEL IN PROGRESS", null);
  await new Promise(resolve => setTimeout(resolve, 1500));

  while (challengerHp > 0 && opponentHp > 0 && turn < maxTurns) {
    turn++;

    // Update phase
    if (turn <= 3) {
      currentPhase = "⚡ OPENING STRIKE";
    } else if (challengerHp < maxHpChallenger * 0.3 || opponentHp < maxHpOpponent * 0.3) {
      currentPhase = "🔥 DESPERATE";
    } else {
      currentPhase = "⚔️ MID-FIGHT";
    }

    let phaseBonus = { critBonus: 0, damageBonus: 0, dodgeBonus: 0 };
    if (turn <= 3) {
      phaseBonus = { critBonus: 50, damageBonus: 0, dodgeBonus: 0 };
    } else if (challengerHp < maxHpChallenger * 0.3 || opponentHp < maxHpOpponent * 0.3) {
      phaseBonus = { critBonus: 0, damageBonus: 30, dodgeBonus: 15 };
    }

    // CHALLENGER'S TURN
    if (!challengerStunned) {
      const challengerDodgeChance = opponentDodge + (opponentHp < maxHpOpponent * 0.3 ? phaseBonus.dodgeBonus : 0);
      if (Math.random() * 100 < challengerDodgeChance) {
        lastChallengerAction = `💨 **${opponentUser.username}** dodged **${challengerUser.username}**'s attack!`;
      } else {
        const variance = 0.8 + (Math.random() * 0.4);
        // Use League of Legends armor formula: Damage = Attack × (1 - Defense/(Defense+100))
        const defenseReduction = opponentDefense / (opponentDefense + 100);
        let damage = Math.floor(challengerAttack * (1 - defenseReduction) * variance);
        if (damage < 5) damage = 5;

        // Apply set damage bonus
        damage = Math.floor(damage * challengerDamageBonus);

        if (challengerHp < maxHpChallenger * 0.3) {
          damage = Math.floor(damage * (1 + phaseBonus.damageBonus / 100));
        }

        // Check for elemental reaction procs
        if (challengerReaction && Math.random() < (challengerReaction.procChance || 0.15)) {
          if (challengerReaction.damageMultiplier) {
            damage = Math.floor(damage * challengerReaction.damageMultiplier);
            procMessages.push(`🌟 ${challengerReaction.name}`);
          }
          if (challengerReaction.bonusDamage) {
            damage += challengerReaction.bonusDamage;
            procMessages.push(`🌟 ${challengerReaction.name}`);
          }
          if (challengerReaction.stunChance && Math.random() < challengerReaction.stunChance) {
            opponentStunned = true;
            procMessages.push(`🌟 ${challengerReaction.name}`);
          }
        }

        const critChance = challengerCrit + (turn <= 3 ? phaseBonus.critBonus : 0);
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) damage = Math.floor(damage * (1 + challengerCritDMG / 100));

        let procMessages = [];
        
        if (Math.random() * 100 < (15 + challengerLuck * 5)) {
          // Crushing blow bonus based on armor effectiveness (not raw armor value)
          const bonusDamage = Math.floor(damage * 0.3);
          damage += bonusDamage;
          procMessages.push("💥");
        }

        const furyProc = Math.random() * 100 < (20 + challengerLuck * 3);
        if (furyProc) procMessages.push("⚡");

        if (Math.random() * 100 < (10 + challengerLuck * 3)) {
          const heal = Math.floor(damage * 0.3);
          challengerHp = Math.min(challengerHp + heal, maxHpChallenger);
          procMessages.push("💚");
        }

        if (Math.random() * 100 < (5 + challengerLuck * 2)) {
          opponentStunned = true;
          procMessages.push("💫");
        }

        opponentHp -= damage;

        const procText = procMessages.length > 0 ? ` [${procMessages.join(" ")}]` : "";
        lastChallengerAction = `⚔️ **${challengerUser.username}** → ${damage} DMG${isCrit ? " (CRIT)" : ""}${procText}`;

        if (furyProc && opponentHp > 0) {
          const furyDefenseReduction = opponentDefense / (opponentDefense + 100);
          let furyDamage = Math.floor(challengerAttack * (1 - furyDefenseReduction) * (0.8 + Math.random() * 0.4) * 0.6);
          if (furyDamage < 5) furyDamage = 5;
          opponentHp -= furyDamage;
          lastChallengerAction += ` +${furyDamage}`;
        }

        if (opponentHp > 0 && Math.random() * 100 < opponentCounter) {
          const opponentCounterDefenseReduction = challengerDefense / (challengerDefense + 100);
          let counterDamage = Math.floor(opponentAttack * (1 - opponentCounterDefenseReduction) * 0.5);
          if (counterDamage < 3) counterDamage = 3;
          challengerHp -= counterDamage;
          lastChallengerAction += ` 🔄-${counterDamage}`;
        }
      }
    } else {
      lastChallengerAction = `💫 **${challengerUser.username}** is stunned!`;
      challengerStunned = false;
    }

    await updateDisplay("⚔️ DUEL IN PROGRESS", null);
    
    if (opponentHp <= 0 || challengerHp <= 0) break;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    // OPPONENT'S TURN
    if (!opponentStunned) {
      const opponentDodgeChance = challengerDodge + (challengerHp < maxHpChallenger * 0.3 ? phaseBonus.dodgeBonus : 0);
      if (Math.random() * 100 < opponentDodgeChance) {
        lastOpponentAction = `💨 **${challengerUser.username}** dodged **${opponentUser.username}**'s attack!`;
      } else {
        const variance = 0.8 + (Math.random() * 0.4);
        // Use League of Legends armor formula: Damage = Attack × (1 - Defense/(Defense+100))
        const defenseReduction = challengerDefense / (challengerDefense + 100);
        let oppDamage = Math.floor(opponentAttack * (1 - defenseReduction) * variance);
        if (oppDamage < 5) oppDamage = 5;

        // Apply set damage bonus
        oppDamage = Math.floor(oppDamage * opponentDamageBonus);

        if (opponentHp < maxHpOpponent * 0.3) {
          oppDamage = Math.floor(oppDamage * (1 + phaseBonus.damageBonus / 100));
        }

        // Check for elemental reaction procs
        if (opponentReaction && Math.random() < (opponentReaction.procChance || 0.15)) {
          if (opponentReaction.damageMultiplier) {
            oppDamage = Math.floor(oppDamage * opponentReaction.damageMultiplier);
            procMessages.push(`🌟 ${opponentReaction.name}`);
          }
          if (opponentReaction.bonusDamage) {
            oppDamage += opponentReaction.bonusDamage;
            procMessages.push(`🌟 ${opponentReaction.name}`);
          }
          if (opponentReaction.stunChance && Math.random() < opponentReaction.stunChance) {
            challengerStunned = true;
            procMessages.push(`🌟 ${opponentReaction.name}`);
          }
        }

        const critChance = opponentCrit + (turn <= 3 ? phaseBonus.critBonus : 0);
        const isOppCrit = Math.random() * 100 < critChance;
        if (isOppCrit) oppDamage = Math.floor(oppDamage * (1 + opponentCritDMG / 100));

        let procMessages = [];
        
        if (Math.random() * 100 < (15 + opponentLuck * 5)) {
          // Crushing blow bonus based on effective damage (not raw defense)
          const bonusDamage = Math.floor(oppDamage * 0.3);
          oppDamage += bonusDamage;
          procMessages.push("💥");
        }

        const furyProc = Math.random() * 100 < (20 + opponentLuck * 3);
        if (furyProc) procMessages.push("⚡");

        if (Math.random() * 100 < (10 + opponentLuck * 3)) {
          const heal = Math.floor(oppDamage * 0.3);
          opponentHp = Math.min(opponentHp + heal, maxHpOpponent);
          procMessages.push("💚");
        }

        if (Math.random() * 100 < (5 + opponentLuck * 2)) {
          challengerStunned = true;
          procMessages.push("💫");
        }

        challengerHp -= oppDamage;

        const procText = procMessages.length > 0 ? ` [${procMessages.join(" ")}]` : "";
        lastOpponentAction = `⚔️ **${opponentUser.username}** → ${oppDamage} DMG${isOppCrit ? " (CRIT)" : ""}${procText}`;

        if (furyProc && challengerHp > 0) {
          const opponentFuryDefenseReduction = challengerDefense / (challengerDefense + 100);
          let furyDamage = Math.floor(opponentAttack * (1 - opponentFuryDefenseReduction) * (0.8 + Math.random() * 0.4) * 0.6);
          if (furyDamage < 5) furyDamage = 5;
          challengerHp -= furyDamage;
          lastOpponentAction += ` +${furyDamage}`;
        }

        if (challengerHp > 0 && Math.random() * 100 < challengerCounter) {
          const challengerCounterDefenseReduction = opponentDefense / (opponentDefense + 100);
          let counterDamage = Math.floor(challengerAttack * (1 - challengerCounterDefenseReduction) * 0.5);
          if (counterDamage < 3) counterDamage = 3;
          opponentHp -= counterDamage;
          lastOpponentAction += ` 🔄-${counterDamage}`;
        }
      }
    } else {
      lastOpponentAction = `💫 **${opponentUser.username}** is stunned!`;
      opponentStunned = false;
    }

    await updateDisplay("⚔️ DUEL IN PROGRESS", null);
    
    if (challengerHp <= 0 || opponentHp <= 0) break;
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const winner = challengerHp > opponentHp ? "challenger" : "opponent";
  const winnerName = winner === "challenger" ? challengerUser.username : opponentUser.username;
  
  await updateDisplay("⚔️ DUEL COMPLETE!", `\n🏆 **${winnerName} WINS!**`);

  // Return just winner info (we don't need full log anymore)
  return { winner, log: "" };
}

async function handleRaid(interaction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const userName = interaction.user.username;

  try {
    // Check 1-hour cooldown
    const oneHour = 60 * 60 * 1000;
    const cooldown = await Cooldown.findOne({ userId, commandName: "raid" });

    if (cooldown && Date.now() < cooldown.endsAt) {
      const timeRemaining = Math.ceil((cooldown.endsAt - Date.now()) / 1000 / 60); // minutes
      
      // Show boss status while on cooldown
      let raidBoss = await RaidBoss.findOne({});
      if (!raidBoss) {
        return interaction.editReply({
          content: `⏳ You're recovering from your last raid! Try again in **${timeRemaining} minutes**.`,
        });
      }

      // Check if in downtime
      if (raidBoss.bossDefeatedTime) {
        const timeSinceDefeat = Date.now() - raidBoss.bossDefeatedTime.getTime();
        if (timeSinceDefeat < oneHour) {
          const timeUntilNextBoss = Math.ceil((oneHour - timeSinceDefeat) / 1000 / 60);
          
          const leaderboardText = raidBoss.leaderboard
            .slice(0, 5)
            .map((entry, idx) => `${idx + 1}. **${entry.username}** - ${entry.damageDealt.toLocaleString()} dmg`)
            .join("\n") || "No participants";

          const embed = new EmbedBuilder()
            .setTitle("🎉 Raid Cycle Complete!")
            .setDescription(`The **${raidBoss.bossName}** has been defeated!`)
            .addFields(
              { name: "🏆 Top Damage Dealers", value: leaderboardText, inline: false },
              { name: "⏰ Next Boss Spawns In", value: `**${timeUntilNextBoss}** minute${timeUntilNextBoss !== 1 ? 's' : ''}`, inline: false },
              { name: "⏳ Your Cooldown", value: `**${timeRemaining}** minute${timeRemaining !== 1 ? 's' : ''}`, inline: false }
            )
            .setColor(0xffd700)
            .setTimestamp();

          // Check if user participated and show their rewards
          const userEntry = raidBoss.leaderboard.find(e => e.userId === userId);
          if (userEntry) {
            const totalCycleDamage = raidBoss.leaderboard.reduce((sum, e) => sum + e.damageDealt, 0);
            const damagePercent = userEntry.damageDealt / totalCycleDamage;
            const placement = raidBoss.leaderboard.findIndex(e => e.userId === userId) + 1;
            
            const baseReward = 50000;
            const moneyPool = raidBoss.maxHp * 10; // Scales with boss difficulty
            const poolReward = Math.floor(moneyPool * damagePercent);
            const reward = baseReward + poolReward;
            
            const xpEarned = raidBoss.maxHp;
            
            // Determine item rarity received
            let itemRarity = "None";
            if (placement === 1) {
              itemRarity = "Legendary";
            } else if (placement === 2) {
              itemRarity = "Legendary/Epic";
            } else if (placement === 3) {
              itemRarity = "Epic";
            } else if (placement <= 5) {
              itemRarity = "Epic/Rare";
            } else if (placement <= 10) {
              itemRarity = "Rare";
            } else {
              itemRarity = "Rare/Uncommon";
            }

            embed.addFields(
              { name: "💰 Your Rewards", value: `Placement: #${placement}\nMoney: $${reward.toLocaleString()}\nXP: ${xpEarned.toLocaleString()}\nItem: ${itemRarity}`, inline: false }
            );
          } else {
            embed.addFields(
              { name: "💰 Your Rewards", value: "You did not participate in this cycle.", inline: false }
            );
          }

          return interaction.editReply({ embeds: [embed] });
        }
      }

      const leaderboardText = raidBoss.leaderboard
        .slice(0, 3)
        .map((entry, idx) => `${idx + 1}. **${entry.username}** - ${entry.damageDealt.toLocaleString()} dmg`)
        .join("\n") || "No participants yet";

      const embed = new EmbedBuilder()
        .setTitle(`🐉 ${raidBoss.bossName}`)
        .setDescription(raidBoss.bossDescription)
        .addFields(
          { name: "❤️ Boss Health", value: `${raidBoss.currentHp.toLocaleString()} / ${raidBoss.maxHp.toLocaleString()}`, inline: true },
          { name: "📊 Progress", value: `${((raidBoss.maxHp - raidBoss.currentHp) / raidBoss.maxHp * 100).toFixed(1)}% damaged`, inline: true },
          { name: "📊 Health Bar", value: getHealthBar(raidBoss.currentHp, raidBoss.maxHp), inline: false },
          { name: "🏆 Top Damage Dealers", value: leaderboardText, inline: false },
          { name: "👥 Total Participants", value: raidBoss.participantsThisCycle.length.toString(), inline: true },
          { name: "⏳ Your Cooldown", value: `**${timeRemaining}** minute${timeRemaining !== 1 ? 's' : ''}`, inline: true }
        )
        .setColor(0x808080)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // Get or create raid boss
    let raidBoss = await RaidBoss.findOne({});
    if (!raidBoss) {
      const bossStats = await calculateBossStats();
      raidBoss = new RaidBoss({
        bossName: "Le Gromp",
        bossDescription: "An ancient amphibian guardian that grows stronger with each challenger",
        currentHp: bossStats.maxHp,
        maxHp: bossStats.maxHp,
        attack: bossStats.attack,
        defense: bossStats.defense,
        level: bossStats.level,
        leaderboard: [],
        participantsThisCycle: [],
        cycleStartTime: new Date(),
        bossDefeatedTime: null
      });
      await raidBoss.save();
    }

    // Check if boss is in downtime (defeated less than 1 hour ago)
    const oneHourInMs = 60 * 60 * 1000;
    const now = new Date();
    
    if (raidBoss.bossDefeatedTime) {
      const timeSinceDefeat = now - raidBoss.bossDefeatedTime;
      
      if (timeSinceDefeat < oneHourInMs) {
        // Still in downtime - show rewards
        const timeUntilNextBoss = Math.ceil((oneHourInMs - timeSinceDefeat) / 1000 / 60); // minutes
        
        const leaderboardText = raidBoss.leaderboard
          .slice(0, 5)
          .map((entry, idx) => `${idx + 1}. **${entry.username}** - ${entry.damageDealt.toLocaleString()} dmg`)
          .join("\n") || "No participants";

        const embed = new EmbedBuilder()
          .setTitle("🎉 Raid Cycle Complete!")
          .setDescription(`The **${raidBoss.bossName}** has been defeated!`)
          .addFields(
            { name: "🏆 Top Damage Dealers", value: leaderboardText, inline: false },
            { name: "⏰ Next Boss Spawns In", value: `**${timeUntilNextBoss}** minute${timeUntilNextBoss !== 1 ? 's' : ''}`, inline: false }
          )
          .setColor(0xffd700)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } else {
        // Downtime expired - spawn new boss
        const newBossStats = await calculateBossStats();
        raidBoss.currentHp = newBossStats.maxHp;
        raidBoss.maxHp = newBossStats.maxHp;
        raidBoss.attack = newBossStats.attack;
        raidBoss.defense = newBossStats.defense;
        raidBoss.level = newBossStats.level;
        raidBoss.leaderboard = [];
        raidBoss.participantsThisCycle = [];
        raidBoss.cycleStartTime = new Date();
        raidBoss.bossDefeatedTime = null;
        await raidBoss.save();
      }
    }

    // Get user profile
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return interaction.editReply({ content: "❌ You don't have a profile yet! Use `/profile` first." });
    }

    // Simulate raid battle
    const battleResult = await simulateRaidBattle(userProfile, raidBoss, interaction.user);
    
    let totalDamageDealt = battleResult.totalPlayerDamage;
    const playerDefeated = battleResult.playerDefeated;
    const bossDefeated = battleResult.bossDefeated;

    // Apply damage to boss
    const damageUpdate = await RaidBoss.findByIdAndUpdate(
      raidBoss._id,
      {
        $inc: { currentHp: -totalDamageDealt },
        $push: { participantsThisCycle: userId },
      },
      { new: true }
    );

    // Update or add leaderboard entry
    const existingEntry = raidBoss.leaderboard.find(e => e.userId === userId);
    if (existingEntry) {
      await RaidBoss.updateOne(
        { _id: raidBoss._id, "leaderboard.userId": userId },
        { $inc: { "leaderboard.$.damageDealt": totalDamageDealt } }
      );
    } else {
      await RaidBoss.updateOne(
        { _id: raidBoss._id },
        { $push: { leaderboard: { userId, username: userName, damageDealt: totalDamageDealt } } }
      );
    }

    // Re-fetch and check if boss is defeated
    raidBoss = await RaidBoss.findOne({});
    raidBoss.leaderboard.sort((a, b) => b.damageDealt - a.damageDealt);
    
    const isBossDefeated = raidBoss.currentHp <= 0;

    // Set cooldown - Mudae style (resets at top of next hour)
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0); // Next hour at :00
    
    let newCooldown = cooldown || new Cooldown({ userId, commandName: "raid" });
    newCooldown.endsAt = nextHour;
    await newCooldown.save();

    // Build response embed
    const embed = new EmbedBuilder()
      .setTitle(`🐉 ${raidBoss.bossName}`)
      .setDescription(raidBoss.bossDescription)
      .addFields(
        { name: "⚔️ Battle Summary", value: battleResult.combatLog.slice(0, 1024), inline: false },
        { name: "❤️ Boss Health", value: `${raidBoss.currentHp.toLocaleString()} / ${raidBoss.maxHp.toLocaleString()}`, inline: true },
        { name: "📊 Health Bar", value: getHealthBar(raidBoss.currentHp, raidBoss.maxHp), inline: false }
      );

    if (playerDefeated) {
      embed.setColor(0xff0000);
      embed.addFields(
        { name: "💀 You were defeated!", value: `Your battle ended after taking too much damage.`, inline: false }
      );
    } else {
      embed.setColor(0xffaa00);
      embed.addFields(
        { name: "⚔️ You Survived!", value: `Your battle has ended. You dealt **${totalDamageDealt.toLocaleString()}** damage!`, inline: false }
      );
    }

    if (isBossDefeated) {
      // Distribute victory rewards
      const baseReward = 50000;
      const moneyPool = raidBoss.maxHp * 10; // Scales with boss difficulty
      const totalCycleDamage = raidBoss.leaderboard.reduce((sum, e) => sum + e.damageDealt, 0);

      embed.setColor(0xffd700);
      embed.setTitle("🎉 RAID BOSS DEFEATED! 🎉");
      embed.addFields(
        { name: "🏆 Top 5 Damage Dealers", value: getLeaderboardText(raidBoss.leaderboard), inline: false }
      );

      // Mark boss as defeated
      raidBoss.bossDefeatedTime = new Date();
      await raidBoss.save();

      // Reward all participants
      for (let i = 0; i < raidBoss.participantsThisCycle.length; i++) {
        const participant = raidBoss.participantsThisCycle[i];
        const profile = await UserProfile.findOne({ userId: participant });
        if (profile) {
          const participantEntry = raidBoss.leaderboard.find(e => e.userId === participant);
          const damagePercent = participantEntry ? participantEntry.damageDealt / totalCycleDamage : 0;
          const placement = raidBoss.leaderboard.findIndex(e => e.userId === participant) + 1;
          
          // Base reward + damage% of money pool
          const poolReward = Math.floor(moneyPool * damagePercent);
          const reward = baseReward + poolReward;
          profile.balance += reward;
          
          // XP = boss max HP
          profile.xp += raidBoss.maxHp;
          
          // Item drops (victory)
          let droppedItem = null;
          if (placement === 1) {
            droppedItem = await generateItem('Legendary');
          } else if (placement === 2) {
            const legChance = Math.random() < 0.5;
            droppedItem = await generateItem(legChance ? 'Legendary' : 'Epic');
          } else if (placement === 3) {
            droppedItem = await generateItem('Epic');
          } else if (placement <= 5) {
            const epicChance = Math.random() < 0.3;
            droppedItem = await generateItem(epicChance ? 'Epic' : 'Rare');
          } else if (placement <= 10) {
            droppedItem = await generateItem('Rare');
          } else {
            const roll = Math.random();
            if (roll < 0.25) droppedItem = await generateItem('Rare');
            else if (roll < 0.75) droppedItem = await generateItem('Uncommon');
          }
          
          if (droppedItem) {
            const existingItem = profile.inventory.find(i => i.itemId === droppedItem.itemId);
            if (existingItem) {
              existingItem.quantity++;
            } else {
              profile.inventory.push({ itemId: droppedItem.itemId, quantity: 1 });
            }
          }
          
          await profile.save();
          
          // If this is the current user, show their rewards
          if (participant === userId) {
            const itemName = droppedItem ? `${droppedItem.emoji} ${droppedItem.name}` : "None";
            embed.addFields(
              { name: "💰 Your Rewards", value: `$${reward.toLocaleString()}\n${raidBoss.maxHp.toLocaleString()} XP\n${itemName}`, inline: true }
            );
          }
        }
      }
    } else {
      embed.addFields(
        { name: "🏆 Top 3 Damage Dealers", value: getLeaderboardText(raidBoss.leaderboard, 3), inline: false },
        { name: "👥 Total Participants", value: raidBoss.participantsThisCycle.length.toString(), inline: true }
      );
    }

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Raid error:", error);
    return interaction.editReply({ content: "❌ An error occurred during the raid!" });
  }
}

function getHealthBar(current, max, length = 20) {
  const percent = Math.max(0, Math.min(1, current / max));
  const filled = Math.floor(length * percent);
  const empty = length - filled;
  
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percentText = Math.round(percent * 100);
  
  return `${bar} ${percentText}%`;
}

function getLeaderboardText(leaderboard, limit = 5) {
  return leaderboard
    .slice(0, limit)
    .map((entry, idx) => `${idx + 1}. **${entry.username}** - ${entry.damageDealt.toLocaleString()} dmg`)
    .join("\n") || "No participants yet";
}

async function calculateBossStats() {
  // Simulate combat for each player to calculate their average damage and durability
  const allPlayers = await UserProfile.find({});
  
  if (allPlayers.length === 0) {
    // Fallback if no players
    return {
      level: 1,
      attack: 50,
      defense: 30,
      maxHp: 5000
    };
  }

  let totalAvgDamage = 0;
  let totalAvgHp = 0;
  let totalAvgDefense = 0;

  // Simulate each player's damage and calculate durability
  for (const player of allPlayers) {
    const buffs = await calculateActiveBuffs(player);
    const playerAttack = Math.floor((25 + player.level * 2 + (playerBuffs.attackFlat || 0)) * (1 + playerBuffs.attack));
    const playerDefense = Math.floor((12 + player.level + (playerBuffs.defenseFlat || 0)) * (1 + playerBuffs.defense));
    const playerHp = Math.floor((250 + player.level * 15 + (playerBuffs.hpFlat || 0)) * (1 + (playerBuffs.hpPercent || 0)));
    
    totalAvgHp += playerHp;
    totalAvgDefense += playerDefense;
    
    // Simulate 10 hits to get average
    let totalDamage = 0;
    for (let i = 0; i < 10; i++) {
      // Use a dummy enemy for comparison
      const dummyDefense = 50;
      const damageReduction = dummyDefense / (dummyDefense + 100);
      let damage = playerAttack * (1 - damageReduction);
      
      // Apply variance
      const variance = 0.8 + Math.random() * 0.4;
      damage = Math.max(1, Math.floor(damage * variance));
      
      // Check crit
      const critChance = 5 + (buffs.critChance || 0);
      if (Math.random() * 100 < critChance) {
        const critDMG = 100 + (buffs.critDMG || 0);
        damage = Math.floor(damage * (1 + critDMG / 100));
      }
      
      totalDamage += damage;
    }
    
    const avgDamagePerTurn = totalDamage / 10;
    totalAvgDamage += avgDamagePerTurn;
  }

  const avgDamageAllPlayers = totalAvgDamage / allPlayers.length;
  const avgPlayerHp = totalAvgHp / allPlayers.length;
  const avgPlayerDefense = totalAvgDefense / allPlayers.length;
  const avgLevel = allPlayers.reduce((sum, p) => sum + p.level, 0) / allPlayers.length || 1;

  // Scale boss to be challenging for the group
  const bossLevel = Math.ceil(avgLevel * 1.5);
  
  // HP: Significantly increased to require teamwork
  // Base 10k + scales heavily with both player count AND damage
  // With 1-hour cooldown, players can attack more often, so boss needs way more HP
  const maxHp = Math.ceil(10000 + allPlayers.length * (avgDamageAllPlayers * 50)); // Increased from 15 to 50
  
  // ATTACK: Scaled to kill average player in ~5 turns
  // Target is 5 turns, so avgPlayerHp / 5 damage needed per turn
  // Account for player dodge (avg 15%) and defense reduction
  const targetTurnsToKill = 5;
  const avgDodgeChance = 15; // Average dodge chance
  const damageReductionAgainstBoss = avgPlayerDefense / (avgPlayerDefense + 100);
  
  // Boss needs to deal X damage per turn to kill in 5 turns
  let bossAttackNeeded = Math.ceil(avgPlayerHp / targetTurnsToKill);
  
  // Adjust for dodge (if 15% dodge, boss needs to deal more to account for missed turns)
  bossAttackNeeded = Math.ceil(bossAttackNeeded / (1 - avgDodgeChance / 100));
  
  // Reverse the damage reduction formula: what attack stat is needed to deal this damage after defense?
  const baseAttack = Math.ceil(bossAttackNeeded / (1 - damageReductionAgainstBoss));
  
  // Ensure it scales with player damage (at least 1.8x average player damage)
  const minAttack = Math.ceil(avgDamageAllPlayers * 1.8);
  const bossAttack = Math.max(baseAttack, minAttack);

  const bossDefense = Math.ceil((avgLevel + 12) * 1.5);

  // Log boss generation
  console.log('\n' + '='.repeat(70));
  console.log(`🐉 LE GROMP STATS GENERATED - ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));
  console.log(`📊 Player Data:`);
  console.log(`   Total Players: ${allPlayers.length}`);
  console.log(`   Avg Player Level: ${avgLevel.toFixed(1)}`);
  console.log(`   Avg Player HP: ${avgPlayerHp.toFixed(0)}`);
  console.log(`   Avg Player Defense: ${avgPlayerDefense.toFixed(0)}`);
  console.log(`   Avg Player Damage: ${avgDamageAllPlayers.toFixed(1)}/turn`);
  console.log(`\n🐉 Boss Stats:`);
  console.log(`   Level: ${bossLevel}`);
  console.log(`   Attack: ${bossAttack} (target: ${bossAttackNeeded.toFixed(0)} dmg/turn to kill in ${targetTurnsToKill} turns)`);
  console.log(`   Defense: ${bossDefense}`);
  console.log(`   Max HP: ${maxHp.toLocaleString()}`);
  console.log('='.repeat(70) + '\n');

  return {
    level: bossLevel,
    attack: bossAttack,
    defense: bossDefense,
    maxHp: maxHp
  };
}

async function simulateRaidBattle(playerProfile, raidBoss, playerUser) {
  // Get player stats
  const playerBuffs = await calculateActiveBuffs(playerProfile);
  const playerAttack = Math.floor((25 + playerProfile.level * 2 + (playerBuffs.attackFlat || 0)) * (1 + playerBuffs.attack));
  const playerDefense = Math.floor((12 + playerProfile.level + (playerBuffs.defenseFlat || 0)) * (1 + playerBuffs.defense));
  const playerCrit = 5 + (playerBuffs.critChance || 0);
  const playerCritDMG = 100 + (playerBuffs.critDMG || 0);
  const playerLuck = playerBuffs.luck || 0;
  let playerHp = Math.floor((250 + playerProfile.level * 15 + (playerBuffs.hpFlat || 0)) * (1 + (playerBuffs.hpPercent || 0)));
  const maxPlayerHp = playerHp;

  // Boss stats
  let bossHp = raidBoss.currentHp;
  const maxBossHp = raidBoss.maxHp;
  const bossDodge = Math.min(5 + (playerLuck * 10), 30); // Boss dodge scales with player luck
  
  let totalPlayerDamage = 0;
  let turn = 0;
  const maxTurns = 100;
  let combatLog = "";

  while (playerHp > 0 && bossHp > 0 && turn < maxTurns) {
    turn++;

    // PLAYER'S TURN
    // Check dodge
    if (Math.random() * 100 < bossDodge) {
      combatLog += `💨 **${raidBoss.bossName}** dodges!\n`;
    } else {
      // Calculate damage
      const variance = 0.8 + (Math.random() * 0.4);
      const damageReduction = raidBoss.defense / (raidBoss.defense + 100);
      let damage = Math.floor(playerAttack * (1 - damageReduction) * variance);
      if (damage < 1) damage = 1;

      // Check for crit
      const isCrit = Math.random() * 100 < playerCrit;
      if (isCrit) {
        damage = Math.floor(damage * (1 + playerCritDMG / 100));
      }

      // Crushing Blow proc
      let procMessages = [];
      if (Math.random() * 100 < (15 + playerLuck * 5)) {
        const bonusDamage = Math.floor(raidBoss.defense * 0.5 * variance);
        damage += bonusDamage;
        procMessages.push("💥 CRUSHING BLOW");
      }

      // Lifesteal
      if (Math.random() * 100 < (10 + playerLuck * 3)) {
        const heal = Math.floor(damage * 0.3);
        playerHp = Math.min(playerHp + heal, maxPlayerHp);
        procMessages.push(`💚 LIFESTEAL (+${heal})`);
      }

      bossHp -= damage;
      totalPlayerDamage += damage;

      const procText = procMessages.length > 0 ? ` [${procMessages.join(", ")}]` : "";
      combatLog += `⚔️ **${playerUser.username}** attacks for **${damage}** damage${isCrit ? " (CRIT!)" : ""}${procText}\n`;
    }

    if (bossHp <= 0) break;

    // BOSS'S TURN - Counter-attack
    // Check player dodge
    const playerDodge = Math.min(5 + (playerLuck * 10), 30);
    if (Math.random() * 100 < playerDodge) {
      combatLog += `💨 **${playerUser.username}** dodges!\n`;
    } else {
      // Calculate boss damage
      const variance = 0.8 + (Math.random() * 0.4);
      const bossDamageReduction = playerDefense / (playerDefense + 100);
      let bossDamage = Math.floor(raidBoss.attack * (1 - bossDamageReduction) * variance);
      if (bossDamage < 1) bossDamage = 1;

      // Boss can crit too (10% base)
      if (Math.random() * 100 < 10) {
        bossDamage = Math.floor(bossDamage * 1.5);
      }

      playerHp -= bossDamage;
      combatLog += `🔥 **${raidBoss.bossName}** attacks for **${bossDamage}** damage!\n`;
    }

    // Add spacing for readability
    if (turn % 5 === 0) combatLog += "\n";
  }

  const playerDefeated = playerHp <= 0;
  const bossDefeated = bossHp <= 0;

  if (playerDefeated) {
    combatLog += `\n💀 **${playerUser.username}** was defeated!`;
  } else if (bossDefeated) {
    combatLog += `\n🐉 **${raidBoss.bossName}** was defeated!`;
  } else {
    combatLog += `\n⏰ Battle ended - Max turns reached`;
  }

  return {
    totalPlayerDamage,
    playerDefeated,
    bossDefeated,
    combatLog: combatLog.slice(0, 1024) // Limit to 1024 chars for embed
  };
}



