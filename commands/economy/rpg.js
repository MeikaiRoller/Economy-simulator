const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Cooldown = require("../../schema/Cooldown");
const calculateActiveBuffs = require("../../utils/calculateBuffs");
const { default: prettyMs } = require("pretty-ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rpg")
    .setDescription("RPG adventure commands")
    .addSubcommand((sub) =>
      sub
        .setName("adventure")
        .setDescription("Embark on a dangerous Nether adventure")
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("View your character stats and level")
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
    }
    if (subcommand === "stats") {
      return handleStats(interaction);
    }
  },
};

async function handleAdventure(interaction) {
  await interaction.deferReply();

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
  let baseCooldown = 60 * 60 * 1000; // 1 hour
  if (activeBuffs.cooldownReduction) {
    const reduction = Math.min(activeBuffs.cooldownReduction, 80);
    baseCooldown = Math.floor(baseCooldown * (1 - reduction / 100));
  }
  cooldown.endsAt = new Date(Date.now() + baseCooldown);
  await cooldown.save();

  // Adventure Begins
  let playerCurrentHp = 250; // Increased from 100 to 250
  let currentStage = 1;
  const maxStages = 50;
  let stagesCleared = 0;

  while (currentStage <= maxStages) {
    const enemy = generateEnemy(currentStage);
    let enemyHp = enemy.maxHp;

    // Fight simulation
    while (playerCurrentHp > 0 && enemyHp > 0) {
      // Player attacks
      let damage = playerAttack - enemy.defense;
      if (Math.random() * 100 < playerCrit) {
        damage *= 2; // Critical hit
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
    currentStage++;
  }

  // Calculate rewards
  const baseLoot = Math.floor(Math.random() * 5000) + 5000; // 5000-10000
  const lootMultiplier = 1 + (stagesCleared - 1) * 0.05; // Scales to ~3.45x max at stage 50
  const finalLoot = Math.floor(baseLoot * lootMultiplier * playerLootBoost);

  const baseXP = 20 + stagesCleared * 500;
  const randomBonusXP = Math.floor(Math.random() * 10);
  const finalXP = Math.floor((baseXP + randomBonusXP) * (1 + playerXpBoost));

  userProfile.balance += finalLoot;
  userProfile.xp += finalXP;

  const leveledUp = await handleLevelUp(userProfile);
  await userProfile.save();

  // Build summary embed
  const resultEmbed = new EmbedBuilder()
    .setTitle("🌌 Nether Adventure Complete")
    .setDescription("🏹 You adventured bravely into the Nether!")
    .addFields(
      { name: "Stages Cleared", value: `${stagesCleared}`, inline: true },
      { name: "Level", value: `${userProfile.level}`, inline: true },
      {
        name: "💰 Loot Earned",
        value: `$${finalLoot.toLocaleString()}`,
        inline: true,
      },
      {
        name: "📈 XP Gained",
        value: `${finalXP.toLocaleString()} XP`,
        inline: true,
      }
    )
    .setColor(0x2f3136)
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
  return {
    name: `Nether Creature (Stage ${stage})`,
    maxHp: 50 + stage * 12, // Reduced from 20 to 12
    attack: 8 + stage * 3, // Reduced from 10 + 5*stage to 8 + 3*stage
    defense: 3 + stage * 1.5, // Reduced from 5 + 3*stage to 3 + 1.5*stage
  };
}
