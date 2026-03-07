const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const UserProfile = require('../../schema/UserProfile');
const Item = require('../../schema/Item');
const { SUB_STAT_RANGES, SUB_STAT_POOL } = require('../../utils/generateItem');

// Enhancement costs per level (scales with rarity)
const UPGRADE_COSTS = {
  Common: 5000,
  Uncommon: 10000,
  Rare: 20000,
  Epic: 40000,
  Legendary: 80000,
  Transcendent: 200000
};

// Success rates by level
const SUCCESS_RATES = {
  0: 100, 1: 100, 2: 100, 3: 100, 4: 100,
  5: 100, 6: 100, 7: 100, 8: 100, 9: 100,
  10: 100, 11: 80, 12: 80, 13: 60, 14: 60, 15: 40
};

// Stat bonus per level — applies to MAIN STAT only
function getLevelBonus(level) {
  let totalBonus = 0;
  for (let i = 1; i <= level; i++) {
    if (i <= 5) totalBonus += 2;
    else if (i <= 10) totalBonus += 3;
    else totalBonus += 4;
  }
  return totalBonus;
}

// Roll a fresh substat at the item's rarity tier, avoiding already-used stat types
function rollSubStat(rarity, excludeTypes = []) {
  const available = SUB_STAT_POOL.filter(t => !excludeTypes.includes(t));
  if (available.length === 0) return null;
  const type = available[Math.floor(Math.random() * available.length)];
  const tierRanges = SUB_STAT_RANGES[type];
  const range = tierRanges[rarity] || tierRanges['Legendary'];
  let value = Math.random() * (range[1] - range[0]) + range[0];
  value = (type.includes('%') || type === 'luck')
    ? Math.round(value * 10) / 10
    : Math.floor(value);
  return { type, value };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade your equipment to increase its stats')
    .addStringOption(option =>
      option.setName('item_id')
        .setDescription('The ID of the item to upgrade (from /inv)')
        .setRequired(true)),
  run: async ({ interaction }) => {
    const itemId = interaction.options.getString('item_id');
    
    // Get user profile
    let userProfile = await UserProfile.findOne({ userId: interaction.user.id });
    
    if (!userProfile) {
      return interaction.reply({
        content: '❌ You need to create a profile first! Use `/create-profile`',
        ephemeral: true
      });
    }
    
    // Find the item
    const item = await Item.findOne({ itemId: itemId });
    
    if (!item) {
      return interaction.reply({
        content: '❌ Item not found! Check the item ID from `/inv`.',
        ephemeral: true
      });
    }
    
    // Check if user owns the item
    const ownsItem = userProfile.inventory.some(invItem => 
      invItem.toString() === item._id.toString() || invItem.itemId === item.itemId
    );
    
    if (!ownsItem) {
      return interaction.reply({
        content: '❌ You don\'t own this item!',
        ephemeral: true
      });
    }
    
    // Initialize level if missing (for old items)
    if (item.level === undefined || item.level === null) {
      item.level = 0;
    }
    
    // Check if already max level
    if (item.level >= 15) {
      return interaction.reply({
        content: '❌ This item is already at maximum level (+15)!',
        ephemeral: true
      });
    }
    
    // Calculate cost
    const cost = UPGRADE_COSTS[item.rarity];
    if (!cost) {
      return interaction.reply({
        content: `❌ This item rarity (${item.rarity}) cannot be upgraded.`,
        ephemeral: true
      });
    }
    const totalMoney = (userProfile.balance || 0) + (userProfile.bankBalance || 0);
    
    if (totalMoney < cost) {
      return interaction.reply({
        content: `❌ You need **${cost.toLocaleString()}** gold to upgrade this item! You have **${totalMoney.toLocaleString()}** gold.`,
        ephemeral: true
      });
    }
    
    // Deduct cost
    if ((userProfile.balance || 0) >= cost) {
      userProfile.balance -= cost;
    } else {
      const remaining = cost - (userProfile.balance || 0);
      userProfile.balance = 0;
      userProfile.bankBalance = Math.max(0, (userProfile.bankBalance || 0) - remaining);
    }
    
    // Check success rate
    const successRate = SUCCESS_RATES[item.level];
    const roll = Math.random() * 100;
    const success = roll < successRate;
    
    // Calculate current and new bonuses
    const oldBonus = getLevelBonus(item.level);
    const newBonus = getLevelBonus(item.level + 1);
    
    // Create result embed
    const embed = new EmbedBuilder()
      .setTitle('⚒️ Equipment Enhancement')
      .setColor(success ? 0x00ff00 : 0xff6600);
    
    if (success) {
      item.level += 1;
      const newLevel = item.level;
      const valueIncrease = Math.floor(cost * 0.5);
      item.price = Math.max(0, (Number(item.price) || 0) + (isNaN(valueIncrease) ? 0 : valueIncrease));

      // Main stat preview — only the main stat scales with level
      const boostedMain = (() => {
        const v = item.mainStat.value * (1 + newBonus / 100);
        return (item.mainStat.type.includes('%') || item.mainStat.type === 'energy')
          ? Math.round(v * 10) / 10
          : Math.floor(v);
      })();

      // ── Milestone: unlock 3rd or 4th substat ──
      let unlockedSub = null;
      if (newLevel === 5 || newLevel === 10) {
        const existingTypes = [item.mainStat.type, ...item.subStats.map(s => s.type)];
        unlockedSub = rollSubStat(item.rarity, existingTypes);
        if (unlockedSub) item.subStats.push(unlockedSub);
        item.markModified('subStats');
      }

      // ── Milestone: Inscription at +15 ──
      if (newLevel === 15) {
        await item.save();
        await userProfile.save();

        embed.setTitle('⚒️ Enhancement — ✨ +15 MAX REACHED ✨');
        embed.setColor(0xff8000);
        embed.setDescription(
          `**${item.name}** has reached maximum level!\n\n` +
          `🔮 **INSCRIPTION** — Choose one substat to re-roll.\n` +
          `The higher value is kept permanently. You have **30 seconds**.`
        );
        embed.addFields(
          { name: `${item.mainStat.type} (main)`, value: `**${boostedMain}** *(+${newBonus}% from upgrades)*`, inline: false },
          { name: 'Substats (fixed rolls)', value: item.subStats.map(s => `• **${s.type}**: ${s.value}`).join('\n') || 'None' }
        );
        embed.setFooter({ text: `Remaining Gold: ${((userProfile.balance || 0) + (userProfile.bankBalance || 0)).toLocaleString()}` });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('inscribe_select')
          .setPlaceholder('Pick a substat to re-roll...')
          .addOptions(item.subStats.map((sub, idx) => ({
            label: `${sub.type}: ${sub.value}`,
            description: 'Re-roll and keep the higher value',
            value: String(idx)
          })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const reply = await interaction.reply({ embeds: [embed], components: [row] });

        const doInscribe = async (subIdx, auto = false) => {
          const chosenSub = item.subStats[subIdx];
          const range = (SUB_STAT_RANGES[chosenSub.type]?.[item.rarity]) || (SUB_STAT_RANGES[chosenSub.type]?.['Legendary']);
          let newRoll = Math.random() * (range[1] - range[0]) + range[0];
          newRoll = (chosenSub.type.includes('%') || chosenSub.type === 'luck')
            ? Math.round(newRoll * 10) / 10
            : Math.floor(newRoll);
          const oldVal = chosenSub.value;
          const kept = Math.max(oldVal, newRoll);
          item.subStats[subIdx].value = kept;
          item.markModified('subStats');
          await item.save();
          return { chosenSub, oldVal, newRoll, kept, auto };
        };

        try {
          const collected = await reply.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
          });
          const { chosenSub, oldVal, newRoll, kept } = await doInscribe(parseInt(collected.values[0]));
          const improved = kept > oldVal;
          const resultEmbed = new EmbedBuilder()
            .setTitle('🔮 Inscription Result')
            .setColor(improved ? 0x00ff00 : 0xff8800)
            .setDescription(
              improved
                ? `✨ **Upgraded!** \`${chosenSub.type}\`: ${oldVal} → **${kept}**`
                : `↩️ **Held.** Re-rolled ${newRoll} — original **${oldVal}** was kept.`
            );
          await collected.update({ embeds: [embed, resultEmbed], components: [] });
        } catch {
          // Timeout — auto-inscribe the lowest-value substat
          let lowestIdx = 0;
          item.subStats.forEach((s, i) => { if (s.value < item.subStats[lowestIdx].value) lowestIdx = i; });
          const { chosenSub, oldVal, kept } = await doInscribe(lowestIdx, true);
          await interaction.editReply({
            content: `⏰ Timed out — auto-inscribed **${chosenSub.type}**: ${oldVal} → **${kept}**`,
            components: []
          });
        }
        return;
      }

      // ── Normal upgrade (not a milestone) ──
      await item.save();

      embed.setDescription(`✅ **SUCCESS!**\n\n**${item.name}** enhanced to **+${newLevel}**!`);
      embed.addFields(
        { name: `${item.mainStat.type} (main)`, value: `**${boostedMain}** *(+${newBonus}% from upgrades)*`, inline: true },
        { name: 'Success Rate', value: `${successRate}%`, inline: true },
        { name: 'Cost', value: `${cost.toLocaleString()} gold`, inline: true }
      );

      if (unlockedSub) {
        embed.addFields({
          name: `🎲 New Substat Unlocked at +${newLevel}!`,
          value: `**${unlockedSub.type}**: ${unlockedSub.value}\n*(This value is permanent — it will never be inflated by upgrades)*`
        });
      }

      const nextMilestone = newLevel < 5 ? `+5` : newLevel < 10 ? `+10` : newLevel < 15 ? `+15 (Inscription)` : null;
      const subDisplay = item.subStats.map(s => `• ${s.type}: ${s.value}`).join('\n') || 'None';
      const milestoneNote = nextMilestone ? `\n\n*Next unlock: **${nextMilestone}***` : '';
      embed.addFields({ name: 'Substats', value: subDisplay + milestoneNote });

    } else {
      embed.setDescription(`❌ **FAILED!**\n\n**${item.name}** failed to enhance and remains at **+${item.level}**.`);
      embed.addFields(
        { name: 'Current Level', value: `+${item.level}`, inline: true },
        { name: 'Success Rate', value: `${successRate}%`, inline: true },
        { name: 'Cost', value: `${cost.toLocaleString()} gold`, inline: true }
      );
      embed.addFields({
        name: 'Try Again?',
        value: `Better luck next time! Item is not lost on failure.`
      });
    }
    
    embed.setFooter({ text: `Remaining Gold: ${((userProfile.balance || 0) + (userProfile.bankBalance || 0)).toLocaleString()}` });

    await userProfile.save();
    await interaction.reply({ embeds: [embed] });
  }
};
