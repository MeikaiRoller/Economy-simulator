const { EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Cooldown = require("../../schema/Cooldown");
const calculateActiveBuffs = require("../../utils/calculateBuffs");
const prettyMs = require("pretty-ms");

// Helper Functions

function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

async function handleLevelUp(userProfile) {
  let leveledUp = false;
  while (userProfile.xp >= calculateXPForLevel(userProfile.level)) {
    userProfile.xp -= calculateXPForLevel(userProfile.level);
    userProfile.level += 1;
    leveledUp = true;

    // Correct +1% boosts ➔ add 0.01 not 1
    userProfile.buffs.attackBoost += 0.1;
    userProfile.buffs.defenseBoost += 0.1;
    userProfile.buffs.magicBoost += 0.1;
    userProfile.buffs.magicDefenseBoost += 0.1;
    userProfile.buffs.criticalChance += 0.1;
    userProfile.buffs.healingBoost += 0.1;
    userProfile.buffs.xpBoost += 0.1;

    userProfile.hp += 5; // optional bonus HP if you want
  }
  if (leveledUp) {
    await userProfile.save();
  }
  return leveledUp;
}

function generateEnemy(stage) {
  return {
    name: `Nether Creature (Stage ${stage})`,
    maxHp: 50 + stage * 20,
    attack: 10 + stage * 5,
    defense: 5 + stage * 3,
  };
}

module.exports = {
  data: {
    name: "adventure",
    description: "Embark on a dangerous Nether Adventure!",
  },

  run: async ({ interaction }) => {
    const { default: prettyMs } = await import("pretty-ms");
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only adventure inside a server!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const userId = interaction.user.id;
    let userProfile = await UserProfile.findOne({ userId });

    if (!userProfile) {
      return interaction.editReply({
        content:
          "❌ You need to create a profile first using `/create-profile`!",
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

    // Base Stats
    const baseAttack = 25;
    const baseDefense = 12;
    const baseCritChance = 5;
    const baseMagic = 12;

    // Buffed Player Stats
    const playerAttack = Math.floor(baseAttack * activeBuffs.attack);
    const playerDefense = Math.floor(baseDefense * activeBuffs.defense);
    const playerCrit = baseCritChance + activeBuffs.critChance;
    const playerMagic = Math.floor(baseMagic * activeBuffs.magic);

    const playerHealingBoost = activeBuffs.healingBoost || 1;
    const playerLuck = activeBuffs.luck || 1;
    const playerXpBoost = activeBuffs.xpBoost || 1;
    const playerLootBoost = activeBuffs.lootBoost || 1;
    console.log(`Loot boost stat: ${playerLootBoost}`);

    // Apply cooldown reduction
    let baseCooldown = 60 * 60 * 1000; // 30 minutes
    if (activeBuffs.cooldownReduction) {
      const reduction = Math.min(activeBuffs.cooldownReduction, 80);
      baseCooldown = Math.floor(baseCooldown * (1 - reduction / 100));
    }
    cooldown.endsAt = new Date(Date.now() + baseCooldown);
    await cooldown.save();

    // Adventure Begins
    let playerCurrentHp = 100;
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

        if (enemyHp <= 0) {
          break; // Enemy defeated
        }

        // Enemy attacks
        let enemyDamage = enemy.attack - playerDefense;
        if (enemyDamage < 5) enemyDamage = 5;
        playerCurrentHp -= enemyDamage;
      }

      if (playerCurrentHp <= 0) {
        break; // Player died
      }

      stagesCleared++;
      currentStage++;
    }

    // Adventure Ends

    // Calculate rewards
    const baseLoot = Math.floor(Math.random() * 5000) + 5000; // 5000-10000
    const lootMultiplier = 1 + (stagesCleared - 1) * 1;
    const finalLoot = Math.floor(baseLoot * lootMultiplier * playerLootBoost);

    const baseXP = 20 + stagesCleared * 500; // Base XP based on stages
    const randomBonusXP = Math.floor(Math.random() * 10); // Tiny randomness (0-9 XP)
    const finalXP = Math.floor(
      (baseXP + randomBonusXP) * (1 + playerXpBoost / 100)
    );

    userProfile.balance += finalLoot;
    userProfile.xp += finalXP;

    const leveledUp = await handleLevelUp(userProfile);
    await userProfile.save();

    // Build final summary embed
    const resultEmbed = new EmbedBuilder()
      .setTitle("🌌 Nether Adventure Complete")
      .setDescription(`🏹 You adventured bravely into the Nether!`)
      .addFields(
        { name: "Stages Cleared", value: `${stagesCleared}`, inline: true },
        { name: "Died At Stage", value: `${stagesCleared + 1}`, inline: true },
        {
          name: "Loot Multiplier",
          value: `${lootMultiplier.toFixed(1)}x`,
          inline: true,
        },
        {
          name: "🧪 Nether Sauce Earned",
          value: `${finalLoot.toLocaleString()} 🧪`,
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

    // Optional: Level Up Embed
    if (leveledUp) {
      const levelUpEmbed = new EmbedBuilder()
        .setTitle("🎉 Level Up!")
        .setDescription(
          `You reached **Level ${userProfile.level}**! Your strength has grown!`
        )
        .setColor(0x00ffcc)
        .setTimestamp();

      await interaction.followUp({ embeds: [levelUpEmbed] });
    }
  },
};
