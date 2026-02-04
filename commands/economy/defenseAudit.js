const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");
const calculateActiveBuffs = require("../../utils/calculateBuffs");
const { calculateSetBonuses } = require("../../utils/setbonuses");

function getLevelMultiplier(level = 0) {
  let levelBonusPercent = 0;
  for (let i = 1; i <= level; i++) {
    if (i <= 5) levelBonusPercent += 2;
    else if (i <= 10) levelBonusPercent += 3;
    else levelBonusPercent += 4;
  }
  return 1 + levelBonusPercent / 100;
}

function normalizePercent(value) {
  if (value === undefined || value === null) return 0;
  const num = Number(value) || 0;
  return num > 1 ? num / 100 : num;
}

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "❌ You can only run this command inside a server!",
        flags: 64,
      });
      return;
    }

    const targetUser =
      interaction.options.getUser("target-user") || interaction.user;
    const targetUserId = targetUser.id;

    await interaction.deferReply({ flags: 64 });

    try {
      const userProfile = await UserProfile.findOne({ userId: targetUserId });

      if (!userProfile) {
        await interaction.editReply(
          targetUserId === interaction.user.id
            ? "❌ You don't have a profile yet! Please create one with `/create-profile`."
            : "❌ That user doesn't have a profile yet."
        );
        return;
      }

      // Load equipped items
      const equippedItemIds = userProfile.equipped
        ? Object.values(userProfile.equipped).filter(Boolean)
        : [];

      const equippedItems = [];
      for (const itemId of equippedItemIds) {
        const itemData = await Item.findOne({ itemId });
        if (itemData) equippedItems.push(itemData);
      }

      // Manual breakdown
      let flatDefense = 0;
      let percentFromSubstats = 0;
      let percentFromLegacyItemBuffs = 0;

      const perItemLines = [];

      for (const item of equippedItems) {
        const itemLevel = item.level || 0;
        const levelMultiplier = getLevelMultiplier(itemLevel);

        let itemFlat = 0;
        let itemPercent = 0;

        if (item.mainStat?.type === "defense" && item.mainStat?.value) {
          const boostedValue = item.mainStat.value * levelMultiplier;
          flatDefense += boostedValue;
          itemFlat += boostedValue;
        }

        if (item.subStats?.length) {
          for (const subStat of item.subStats) {
            const boostedValue = subStat.value * levelMultiplier;
            if (subStat.type === "defense") {
              flatDefense += boostedValue;
              itemFlat += boostedValue;
            } else if (subStat.type === "defense%") {
              percentFromSubstats += boostedValue / 100;
              itemPercent += boostedValue / 100;
            }
          }
        }

        if (item.buffs?.defense) {
          const normalized = normalizePercent(item.buffs.defense);
          percentFromLegacyItemBuffs += normalized;
          itemPercent += normalized;
        }

        if (itemFlat || itemPercent) {
          const name = item.name || item.itemId || "Unknown Item";
          const percentText = itemPercent ? `${(itemPercent * 100).toFixed(2)}%` : "0%";
          perItemLines.push(`• ${name}: +${Math.round(itemFlat)} DEF, +${percentText}`);
        }
      }

      const setBonusData = calculateSetBonuses(equippedItems);
      const setBonusDefense = setBonusData.bonuses?.defense || 0;
      const legacyProfileDefenseBoostRaw = userProfile.buffs?.defenseBoost || 0;
      const legacyProfileDefenseBoost = normalizePercent(legacyProfileDefenseBoostRaw);

      const totalPercent =
        legacyProfileDefenseBoost +
        percentFromLegacyItemBuffs +
        percentFromSubstats +
        setBonusDefense;

      const baseDefense = 12 + userProfile.level;
      const manualFinalDefense = Math.round(
        (baseDefense + flatDefense) * (1 + totalPercent)
      );

      // Compare with actual calculation
      const buffs = await calculateActiveBuffs(userProfile);
      const actualFinalDefense = Math.round(
        (baseDefense + (buffs.defenseFlat || 0)) * (1 + (buffs.defense || 0))
      );

      const embed = new EmbedBuilder()
        .setTitle("🛡️ Defense Audit")
        .setColor(0xffc107)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "User", value: `${targetUser.username}`, inline: true },
          { name: "Level", value: `${userProfile.level}`, inline: true },
          { name: "Base DEF", value: `${baseDefense}`, inline: true },
          { name: "Flat DEF (manual)", value: `${Math.round(flatDefense)}`, inline: true },
          {
            name: "Defense% Breakdown",
            value:
              `Legacy profile: ${(legacyProfileDefenseBoost * 100).toFixed(2)}% (raw: ${legacyProfileDefenseBoostRaw})\n` +
              `Legacy item buffs: ${(percentFromLegacyItemBuffs * 100).toFixed(2)}%\n` +
              `Substats: ${(percentFromSubstats * 100).toFixed(2)}%\n` +
              `Set bonuses: ${(setBonusDefense * 100).toFixed(2)}%\n` +
              `**Total: ${(totalPercent * 100).toFixed(2)}%**`,
            inline: false,
          },
          {
            name: "Final DEF",
            value:
              `Manual: **${manualFinalDefense}**\n` +
              `Actual: **${actualFinalDefense}**\n` +
              `Buffs.defense: ${(buffs.defense * 100).toFixed(2)}%\n` +
              `Buffs.defenseFlat: ${Math.round(buffs.defenseFlat || 0)}`,
            inline: false,
          }
        );

      if (perItemLines.length) {
        embed.addFields({
          name: "Per-Item DEF Contributions",
          value: perItemLines.slice(0, 10).join("\n"),
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error handling /defenseaudit:", error);
      await interaction.editReply({
        content: "❌ There was an error running defense audit. Please try again.",
      });
    }
  },

  data: {
    name: "defenseaudit",
    description: "Show a defense calculation breakdown for a user",
    options: [
      {
        name: "target-user",
        description: "The user to audit",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },

  deleted: false,
};
