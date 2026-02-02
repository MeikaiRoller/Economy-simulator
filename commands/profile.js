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

      // Get equipped items with names and rarity colors
      let equipmentList = "❌ None";
      const equipped = [];
      const slots = [
        { key: 'weapon', emoji: '⚔️', label: 'Weapon' },
        { key: 'head', emoji: '👑', label: 'Head' },
        { key: 'chest', emoji: '🧥', label: 'Chest' },
        { key: 'hands', emoji: '🤚', label: 'Hands' },
        { key: 'feet', emoji: '🥾', label: 'Feet' },
        { key: 'accessory', emoji: '💎', label: 'Accessory' }
      ];
      
      const rarityColors = {
        Common: '⚪',
        Uncommon: '🟢',
        Rare: '🔵',
        Epic: '🟣',
        Legendary: '🟠'
      };
      
      for (const slot of slots) {
        if (userProfile.equipped?.[slot.key]) {
          const itemId = userProfile.equipped[slot.key];
          const item = await Item.findOne({ itemId });
          if (item) {
            const rarity = item.rarity || "Common";
            const colorIndicator = rarityColors[rarity] || '⚪';
            equipped.push(`${slot.emoji} **${slot.label}:** ${item.emoji || '📦'} ${item.name} ${colorIndicator}`);
          } else {
            equipped.push(`${slot.emoji} **${slot.label}:** ${itemId}`);
          }
        }
      }
      if (equipped.length > 0) equipmentList = equipped.join("\n");

      // Get buffs (safe)
      let buffs = { attack: 0, defense: 0, magic: 0, magicDefense: 0, critChance: 0, xpBoost: 0, healingBoost: 0, luck: 0, lootBoost: 0, findRateBoost: 0, cooldownReduction: 0 };
      try {
        buffs = await calculateActiveBuffs(userProfile);
      } catch (e) {
        console.error("Buff calculation error:", e);
      }

      // Calculate actual stat values based on level and buffs
      const baseAttack = 25 + (level * 2); // +2 per level
      const baseDefense = 12 + level; // +1 per level
      const baseHP = 100;

      const finalAttack = Math.round(baseAttack * (1 + buffs.attack) + (buffs.attackFlat || 0));
      const finalDefense = Math.round(baseDefense * (1 + buffs.defense) + (buffs.defenseFlat || 0));
      const finalHP = Math.round(baseHP * (1 + (buffs.hpPercent || 0)) + (buffs.hpFlat || 0));
      const finalCritRate = Math.round(5 + (buffs.critChance || 0)); // Base 5% crit
      const finalCritDMG = Math.round(50 + (buffs.critDMG || 0)); // Base 50% crit damage

      const formatStat = (val) => {
        const num = Math.round(val) || 0;
        if (num === 0) return "0";
        return `${num}`;
      };

      const formatPercent = (val) => {
        const num = Math.round(val) || 0;
        if (num === 0) return "0%";
        return `${num}%`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${targetUser.username}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`*A mighty adventurer of the realm*`)
        .addFields(
          // Wealth Section
          { name: "💰 WEALTH", value: `Wallet: ${balance}\nBank: ${bank}\n**Net Worth: ${netWorth}**\n\`${breakdown}\``, inline: false },
          
          // Stats Section
          { name: "🎮 CHARACTER STATS", value: `**Level:** ${level}\n**Experience:** ${currentXP}/${xpNeeded}\n${xpBar}\n**HP:** ${finalHP}`, inline: false },
          
          // Gaming Section
          { name: "🎲 GAMING RECORD", value: `Played: **${played}**\nWins: **${won}** | Losses: **${lost}**\nWin Rate: **${winRate}%**`, inline: false },
          
          // PVP Section
          { name: "⚔️ PVP RECORD", value: `Duels: **${pvpTotal}**\nWins: **${pvpWins}** | Losses: **${pvpLosses}**\nWin Rate: **${pvpWinRate}%**\nNet Profit: **${pvpNetStr}**`, inline: false },
          
          // Equipment Section
          { name: "🛡️ EQUIPMENT", value: equipmentList, inline: false },
          
          // Buffs Section - Show actual calculated values
          { name: "⚔️ OFFENSIVE", value: `Attack: ${formatStat(finalAttack)}\nCrit Rate: ${formatPercent(finalCritRate)}\nCrit DMG: ${formatPercent(finalCritDMG)}`, inline: true },
          { name: "🛡️ DEFENSIVE", value: `Defense: ${formatStat(finalDefense)}`, inline: true },
          { name: "🌟 UTILITY", value: `XP Boost: ${formatPercent(buffs.xpBoost * 100)}\nLuck: ${formatPercent(buffs.luck * 100)}\nCDR: ${formatPercent(buffs.cooldownReduction)}`, inline: true }
        )
        .setColor(0x00ff41)
        .setFooter({ text: `Profile created • Use /inv to manage items`, iconURL: targetUser.displayAvatarURL() })
        .setTimestamp();

      // Add set bonuses and elemental info if available
      if (buffs.setInfo) {
        const setFields = [];
        
        // Active Set Bonuses
        if (buffs.setInfo.activeSetBonuses && buffs.setInfo.activeSetBonuses.length > 0) {
          const setList = buffs.setInfo.activeSetBonuses
            .map(bonus => `${bonus.emoji || ''} **${bonus.setName}** (${bonus.pieces}pc)`)
            .join('\n');
          setFields.push({ name: "✨ ACTIVE SETS", value: setList, inline: false });
        }
        
        // Active Elements (only show if 3+ pieces unlocked)
        if (buffs.setInfo.activeElements && buffs.setInfo.activeElements.length > 0) {
          const elementEmojis = {
            pyro: "🔥",
            electro: "⚡",
            cryo: "❄️",
            anemo: "💨",
            geo: "🪨",
            hydro: "💧"
          };
          const elementList = buffs.setInfo.activeElements
            .map(elem => `${elementEmojis[elem] || ''} ${elem.charAt(0).toUpperCase() + elem.slice(1)}`)
            .join(' • ');
          setFields.push({ name: "🌈 ELEMENTS", value: elementList, inline: false });
        }
        
        // Elemental Resonance (only if 6-piece full set)
        if (buffs.setInfo.elementalResonance) {
          const resonance = buffs.setInfo.elementalResonance;
          setFields.push({ 
            name: `🌟 ${resonance.name}`, 
            value: `*Full set elemental synergy activated!*`, 
            inline: false 
          });
        }
        
        // Elemental Reaction (3+3 different elements)
        if (buffs.setInfo.elementalReaction) {
          const reaction = buffs.setInfo.elementalReaction;
          setFields.push({ 
            name: `⚡ ${reaction.name}`, 
            value: reaction.effect, 
            inline: false 
          });
        }
        
        if (setFields.length > 0) {
          embed.addFields(setFields);
        }
      }

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
