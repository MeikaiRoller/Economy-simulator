const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../schema/UserProfile');
const Item = require('../../schema/Item');

// Enhancement costs per level (scales with rarity)
const UPGRADE_COSTS = {
  Common: 5000,
  Uncommon: 10000,
  Rare: 20000,
  Epic: 40000,
  Legendary: 80000
};

// Success rates by level
const SUCCESS_RATES = {
  0: 100, 1: 100, 2: 100, 3: 100, 4: 100,
  5: 100, 6: 100, 7: 100, 8: 100, 9: 100,
  10: 100, 11: 80, 12: 80, 13: 60, 14: 60, 15: 40
};

// Stat bonus per level
function getLevelBonus(level) {
  let totalBonus = 0;
  for (let i = 1; i <= level; i++) {
    if (i <= 5) totalBonus += 2;
    else if (i <= 10) totalBonus += 3;
    else totalBonus += 4;
  }
  return totalBonus;
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
    const totalMoney = userProfile.wallet + userProfile.bank;
    
    if (totalMoney < cost) {
      return interaction.reply({
        content: `❌ You need **${cost.toLocaleString()}** gold to upgrade this item! You have **${totalMoney.toLocaleString()}** gold.`,
        ephemeral: true
      });
    }
    
    // Deduct cost
    if (userProfile.wallet >= cost) {
      userProfile.wallet -= cost;
    } else {
      const remaining = cost - userProfile.wallet;
      userProfile.wallet = 0;
      userProfile.bank -= remaining;
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
      await item.save();
      
      embed.setDescription(`✅ **SUCCESS!**\n\n**${item.name}** has been enhanced to **+${item.level}**!`);
      embed.addFields(
        { name: 'Current Bonus', value: `+${newBonus}% to all stats`, inline: true },
        { name: 'Success Rate', value: `${successRate}%`, inline: true },
        { name: 'Cost', value: `${cost.toLocaleString()} gold`, inline: true }
      );
      
      // Show stat preview
      const mainStatValue = Math.floor(item.mainStat.value * (1 + newBonus / 100));
      const sampleSubStat = item.subStats[0];
      const subStatValue = sampleSubStat ? (sampleSubStat.value * (1 + newBonus / 100)).toFixed(1) : 'N/A';
      
      embed.addFields({
        name: 'Enhanced Stats',
        value: `${item.mainStat.type}: ${mainStatValue}\n${sampleSubStat ? sampleSubStat.type : 'substat'}: ${subStatValue}\n*(All stats receive +${newBonus}% bonus)*`
      });
      
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
    
    embed.setFooter({ text: `Remaining Gold: ${(userProfile.wallet + userProfile.bank).toLocaleString()}` });
    
    await userProfile.save();
    await interaction.reply({ embeds: [embed] });
  }
};
