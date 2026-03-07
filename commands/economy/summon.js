const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../schema/UserProfile');
const Item = require('../../schema/Item');
const { generateItem, RARITY_COLORS } = require('../../utils/generateItem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon items using gold (gacha system)')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of summons (1 or 10)')
        .setRequired(true)
        .addChoices(
          { name: '1x Summon (100,000 gold) 🎉 LIMITED EVENT', value: 1 },
          { name: '10x Summon (1,000,000 gold) 🎉 LIMITED EVENT', value: 10 }
        )
    ),

  run: async ({ interaction }) => {
    const userId = interaction.user.id;
    const count = interaction.options.getInteger('count');
    
    const cost = count === 1 ? 100000 : 1000000;

    try {
      // Get user profile
      let userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) {
        return interaction.reply({
          content: '❌ You don\'t have a profile! Use `/createprofile` first.',
          ephemeral: true
        });
      }

      // Check if user has enough gold
      if (userProfile.balance < cost) {
        return interaction.reply({
          content: `❌ You need **${cost.toLocaleString()}** gold but only have **${userProfile.balance.toLocaleString()}**!`,
          ephemeral: true
        });
      }

      // Initialize pity counter if it doesn't exist
      if (userProfile.gachaPityCounter === undefined || userProfile.gachaPityCounter === null) {
        userProfile.gachaPityCounter = 0;
      }

      // Deduct gold
      userProfile.balance -= cost;

      // Perform summons
      const pulledItems = [];
      const rarityCounts = {
        Common: 0,
        Uncommon: 0,
        Rare: 0,
        Epic: 0,
        Legendary: 0,
        Transcendent: 0
      };

      let transcendentPulled = false;

      for (let i = 0; i < count; i++) {
        userProfile.gachaPityCounter++;
        
        // Roll rarity with pity system
        const rarity = rollGachaRarity(userProfile.gachaPityCounter);
        
        // Reset pity if Transcendent
        if (rarity === 'Transcendent') {
          userProfile.gachaPityCounter = 0;
          transcendentPulled = true;
        }

        // Generate item
        const slots = ["weapon", "head", "chest", "hands", "feet", "accessory"];
        const randomSlot = slots[Math.floor(Math.random() * slots.length)];
        const itemData = generateItem(randomSlot, rarity);

        // Save to database
        const newItem = new Item(itemData);
        await newItem.save();

        // Add to user inventory
        const existingItem = userProfile.inventory.find(
          invItem => invItem.itemId === newItem.itemId
        );

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          userProfile.inventory.push({
            itemId: newItem.itemId,
            quantity: 1
          });
        }

        pulledItems.push({
          name: itemData.name,
          rarity: itemData.rarity,
          slot: itemData.slot,
          emoji: itemData.emoji
        });

        rarityCounts[rarity]++;
      }

      // Save profile
      await userProfile.save();

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle(`✨ Summoning Results (${count}x Pull)`)
        .setColor(transcendentPulled ? RARITY_COLORS.Transcendent : RARITY_COLORS.Legendary);
      
      // Only add description if Transcendent was pulled
      if (transcendentPulled) {
        embed.setDescription('🌟 **TRANSCENDENT ITEM ACQUIRED!** 🌟\n*A legendary pull!*\n\n');
      }
      
      embed.addFields(
          {
            name: '📦 Items Obtained',
            value: pulledItems.map(item => 
              `${item.emoji} **${item.name}** (${item.rarity})`
            ).join('\n') || 'None',
            inline: false
          },
          {
            name: '📊 Rarity Breakdown',
            value: Object.entries(rarityCounts)
              .filter(([_, count]) => count > 0)
              .map(([rarity, count]) => {
                const emoji = getRarityEmoji(rarity);
                return `${emoji} ${rarity}: ${count}`;
              })
              .join('\n') || 'None',
            inline: true
          },
          {
            name: '💰 Cost',
            value: `${cost.toLocaleString()} gold\n**Remaining:** ${userProfile.balance.toLocaleString()}`,
            inline: true
          }
        )
        .setFooter({ 
          text: `🎉 LIMITED EVENT: 100k/pull | Total Pulls: ${userProfile.gachaPityCounter} | Transcendent Rate: 0.5%` 
        })
        .setTimestamp();

      // Special announcement for Transcendent pulls
      if (transcendentPulled) {
        await interaction.reply({
          content: `🎊 ${interaction.user} just pulled a **TRANSCENDENT** item! 🌟`,
          embeds: [embed]
        });
      } else {
        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error in summon command:', error);
      return interaction.reply({
        content: '❌ An error occurred while summoning items.',
        ephemeral: true
      });
    }
  }
};

/**
 * Roll gacha rarity (no pity system)
 * @param {number} pityCounter - Current pity counter (unused for now)
 * @returns {string} Rolled rarity
 */
function rollGachaRarity(pityCounter) {
  // Pure RNG - no pity system
  const transcendentRate = 0.5; // 0.5% base rate

  const roll = Math.random() * 100;
  
  // Transcendent
  if (roll < transcendentRate) return 'Transcendent';
  
  // Legendary: 5.4%
  if (roll < transcendentRate + 5.4) return 'Legendary';
  
  // Epic: 12%
  if (roll < transcendentRate + 5.4 + 12) return 'Epic';
  
  // Rare: 27%
  if (roll < transcendentRate + 5.4 + 12 + 27) return 'Rare';
  
  // Uncommon: 30%
  if (roll < transcendentRate + 5.4 + 12 + 27 + 30) return 'Uncommon';
  
  // Common: ~25%
  return 'Common';
}

/**
 * Get emoji for rarity
 * @param {string} rarity - Rarity name
 * @returns {string} Emoji
 */
function getRarityEmoji(rarity) {
  const emojis = {
    Common: '⚪',
    Uncommon: '🟢',
    Rare: '🔵',
    Epic: '🟣',
    Legendary: '🟠',
    Transcendent: '🌟'
  };
  return emojis[rarity] || '⚪';
}
