const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const UserProfile = require("../schema/UserProfile");
const StockPortfolio = require("../schema/StockPortfolio");
const Stock = require("../schema/Stock");
const Item = require("../schema/Item");
const calculateActiveBuffs = require("../utils/calculateBuffs");

function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

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

    try {
      const targetUser =
        interaction.options.getUser("target-user") || interaction.user;
      const userProfile = await UserProfile.findOne({ userId: targetUser.id });

      if (!userProfile) {
        await interaction.editReply({
          content: "❌ That user doesn't have a profile yet!",
        });
        return;
      }

      // Build safe string values
      const balance = `$${(userProfile.balance || 0).toLocaleString()}`;
      const bank = `$${(userProfile.bankBalance || 0).toLocaleString()}`;
      
      // Calculate total assets
      let stockValue = 0;
      let inventoryValue = 0;
      
      try {
        // Get stock portfolio value
        const portfolio = await StockPortfolio.findOne({ userId: targetUser.id });
        if (portfolio?.holdings?.length) {
          for (const holding of portfolio.holdings) {
            const stock = await Stock.findOne({ symbol: holding.symbol });
            if (stock) {
              stockValue += (holding.quantity || 0) * (stock.price || 0);
            }
          }
        }
        
        // Get inventory item values
        if (userProfile.inventory?.length) {
          for (const invItem of userProfile.inventory) {
            const item = await Item.findOne({ itemId: invItem.itemId });
            if (item) {
              inventoryValue += (item.price || 0) * (invItem.quantity || 1);
            }
          }
        }
      } catch (e) {
        console.error("Asset calculation error:", e);
      }
      
      const cashTotal = (userProfile.balance || 0) + (userProfile.bankBalance || 0);
      const netWorth = `$${(cashTotal + stockValue + inventoryValue).toLocaleString()}`;
      const breakdown = `Cash: $${cashTotal.toLocaleString()} | Stocks: $${stockValue.toLocaleString()} | Items: $${inventoryValue.toLocaleString()}`;
      const level = userProfile.level || 1;
      const currentXP = userProfile.xp || 0;
      const xpNeeded = calculateXPForLevel(level);
      const xpPercent = Math.floor((currentXP / xpNeeded) * 100);
      const xpBar = `${'█'.repeat(Math.floor(xpPercent / 5))}${'░'.repeat(20 - Math.floor(xpPercent / 5))} ${xpPercent}%`;
      const hp = userProfile.hp || 100;
      const played = userProfile.gamesPlayed || 0;
      const won = userProfile.gamesWon || 0;
      const lost = userProfile.gamesLost || 0;
      const winRate = played > 0 ? ((won / played) * 100).toFixed(1) : 0;
      
      // PVP Stats
      const pvpWins = userProfile.pvpStats?.wins || 0;
      const pvpLosses = userProfile.pvpStats?.losses || 0;
      const pvpTotal = pvpWins + pvpLosses;
      const pvpWinRate = pvpTotal > 0 ? ((pvpWins / pvpTotal) * 100).toFixed(1) : 0;
      const pvpNetProfit = (userProfile.pvpStats?.totalWon || 0) - (userProfile.pvpStats?.totalLost || 0);
      const pvpNetStr = pvpNetProfit >= 0 ? `+$${pvpNetProfit.toLocaleString()}` : `-$${Math.abs(pvpNetProfit).toLocaleString()}`;

      // Get equipped items
      let equipmentList = "❌ None";
      const equipped = [];
      if (userProfile.equipped?.weapon) equipped.push(`⚔️ **Weapon:** ${userProfile.equipped.weapon}`);
      if (userProfile.equipped?.head) equipped.push(`👑 **Head:** ${userProfile.equipped.head}`);
      if (userProfile.equipped?.chest) equipped.push(`🧥 **Chest:** ${userProfile.equipped.chest}`);
      if (userProfile.equipped?.hands) equipped.push(`🤚 **Hands:** ${userProfile.equipped.hands}`);
      if (userProfile.equipped?.feet) equipped.push(`🥾 **Feet:** ${userProfile.equipped.feet}`);
      if (userProfile.equipped?.accessory) equipped.push(`💎 **Accessory:** ${userProfile.equipped.accessory}`);
      if (equipped.length > 0) equipmentList = equipped.join("\n");

      // Get buffs (safe)
      let buffs = { attack: 0, defense: 0, magic: 0, magicDefense: 0, critChance: 0, xpBoost: 0, healingBoost: 0, luck: 0, lootBoost: 0, findRateBoost: 0, cooldownReduction: 0 };
      try {
        buffs = await calculateActiveBuffs(userProfile);
      } catch (e) {
        console.error("Buff calculation error:", e);
      }

      const formatBuff = (val) => {
        const num = Number(val) || 0;
        const percent = Math.round(num * 100);
        if (percent === 0) return "➖ 0%";
        if (percent > 0) return `📈 +${percent}%`;
        return `📉 ${percent}%`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${targetUser.username}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`*A mighty adventurer of the realm*`)
        .addFields(
          // Wealth Section
          { name: "💰 WEALTH", value: `Wallet: ${balance}\nBank: ${bank}\n**Net Worth: ${netWorth}**\n\`${breakdown}\``, inline: false },
          
          // Stats Section
          { name: "🎮 CHARACTER STATS", value: `**Level:** ${level}\n**Experience:** ${currentXP}/${xpNeeded}\n${xpBar}\n**HP:** ${hp}/100`, inline: false },
          
          // Gaming Section
          { name: "🎲 GAMING RECORD", value: `Played: **${played}**\nWins: **${won}** | Losses: **${lost}**\nWin Rate: **${winRate}%**`, inline: false },
          
          // PVP Section
          { name: "⚔️ PVP RECORD", value: `Duels: **${pvpTotal}**\nWins: **${pvpWins}** | Losses: **${pvpLosses}**\nWin Rate: **${pvpWinRate}%**\nNet Profit: **${pvpNetStr}**`, inline: false },
          
          // Equipment Section
          { name: "🛡️ EQUIPMENT", value: equipmentList, inline: false },
          
          // Buffs Section - Organized by type
          { name: "⚔️ OFFENSIVE", value: `Attack: ${formatBuff(buffs.attack)}\nCrit: ${formatBuff(buffs.critChance)}\nMagic: ${formatBuff(buffs.magic)}`, inline: true },
          { name: "🛡️ DEFENSIVE", value: `Defense: ${formatBuff(buffs.defense)}\nMag Def: ${formatBuff(buffs.magicDefense)}\nHealing: ${formatBuff(buffs.healingBoost)}`, inline: true },
          { name: "🌟 UTILITY", value: `XP Boost: ${formatBuff(buffs.xpBoost)}\nLoot: ${formatBuff(buffs.lootBoost)}\nLuck: ${formatBuff(buffs.luck)}`, inline: true },
          { name: "🔍 DISCOVERY", value: `Find Rate: ${formatBuff(buffs.findRateBoost)}\nCooldown Reduction: ${formatBuff(buffs.cooldownReduction)}`, inline: false }
        )
        .setColor(0x00ff41)
        .setFooter({ text: `Profile created • Use /inv to manage items`, iconURL: targetUser.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error in /profile: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        content: "❌ Error fetching profile. Check console for details.",
      });
    }
  },

  data: {
    name: "profile",
    description: "View your profile!",
    options: [
      {
        name: "target-user",
        description: "User to view",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },
};
