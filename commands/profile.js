const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const UserProfile = require("../schema/UserProfile");
const calculateActiveBuffs = require("../utils/calculateBuffs");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only view profiles inside a server!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const targetUser =
      interaction.options.getUser("target-user") || interaction.user;
    const targetUserId = targetUser.id;

    try {
      const userProfile = await UserProfile.findOne({ userId: targetUserId });

      if (!userProfile) {
        await interaction.editReply({
          content:
            targetUserId === interaction.user.id
              ? "❌ You don't have a profile yet! Use `/create-profile` first."
              : "❌ That user doesn't have a profile yet!",
        });
        return;
      }

      const balance = userProfile.balance.toLocaleString();
      const lastDaily = userProfile.lastDailyCollected
        ? userProfile.lastDailyCollected.toDateString()
        : "Not collected yet";
      const createdAt = userProfile.createdAt
        ? userProfile.createdAt.toDateString()
        : "Unknown";

      const gamesPlayed = userProfile.gamesPlayed?.toLocaleString() || "0";
      const gamesWon = userProfile.gamesWon?.toLocaleString() || "0";
      const gamesLost = userProfile.gamesLost?.toLocaleString() || "0";

      const buffs = await calculateActiveBuffs(userProfile);

      const formatBuff = (value) => {
        const val = (value ?? 1) - 1;
        const percent = Math.floor(val * 100);
        return `${percent}%`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`🧑‍💼 Nether Casino Profile: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "🧪 Nether Sauce", value: `${balance}`, inline: true },
          {
            name: "📅 Last Daily Collected",
            value: `${lastDaily}`,
            inline: true,
          },
          { name: "🕰️ Member Since", value: `${createdAt}`, inline: false },
          { name: "🎲 Games Played", value: `${gamesPlayed}`, inline: true },
          { name: "🏆 Games Won", value: `${gamesWon}`, inline: true },
          { name: "💔 Games Lost", value: `${gamesLost}`, inline: true },
          { name: "\u200B", value: "**__Active Buffs__**", inline: false },
          { name: "⚔️ Attack", value: formatBuff(buffs.attack), inline: true },
          {
            name: "🛡️ Defense",
            value: formatBuff(buffs.defense),
            inline: true,
          },
          { name: "🪄 Magic", value: formatBuff(buffs.magic), inline: true },
          {
            name: "✨ Magic Defense",
            value: formatBuff(buffs.magicDefense),
            inline: true,
          },
          {
            name: "🎯 Crit Chance",
            value: formatBuff(buffs.critChance),
            inline: true,
          },
          {
            name: "📝 XP Boost",
            value: formatBuff(buffs.xpBoost),
            inline: true,
          },
          {
            name: "❤️ Healing Boost",
            value: formatBuff(buffs.healingBoost),
            inline: true,
          },
          { name: "🍀 Luck", value: formatBuff(buffs.luck), inline: true },
          {
            name: "🧪 Loot Boost",
            value: formatBuff(buffs.lootBoost),
            inline: true,
          },
          {
            name: "🔍 Find Rate Boost",
            value: formatBuff(buffs.findRateBoost),
            inline: true,
          },
          {
            name: "⏳ Cooldown Reduction",
            value: formatBuff(buffs.cooldownReduction, true),
            inline: true,
          }
        )
        .setColor(0x2f3136)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error handling /profile: ${error}`);
      await interaction.editReply({
        content:
          "❌ There was an error fetching the profile. Please try again later!",
      });
    }
  },

  data: {
    name: "profile",
    description: "View your Nether Casino profile or someone else's!",
    options: [
      {
        name: "target-user",
        description: "The user whose profile you want to view.",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },
};
