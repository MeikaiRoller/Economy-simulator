const { EmbedBuilder } = require("discord.js");
const Cooldown = require("../../schema/Cooldown");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");
const calculateActiveBuffs = require("../../utils/calculateBuffs");

function getRandomNumber(x, y) {
  return Math.floor(Math.random() * (y - x + 1)) + x;
}

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only run this command inside a server!",
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply();

      const commandName = "nether-quest";
      const userId = interaction.user.id;

      let cooldown = await Cooldown.findOne({ userId, commandName });
      if (cooldown && Date.now() < cooldown.endsAt) {
        const { default: prettyMs } = await import("pretty-ms");
        await interaction.editReply(
          `\u23F3 You already went on a Nether quest! Try again after **${prettyMs(
            cooldown.endsAt - Date.now()
          )}**.`
        );
        return;
      }

      if (!cooldown) {
        cooldown = new Cooldown({ userId, commandName });
      }

      let userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) {
        userProfile = new UserProfile({ userId, balance: 0 });
      }

      const activeBuffs = await calculateActiveBuffs(userProfile);
      const oldBalance = userProfile.balance;
      const chance = getRandomNumber(0, 100);

      // Success quest
      let amount = getRandomNumber(10, 50); // 🎯 RANGE: 10-50

      // Apply lootBoost if user has buffs
      if (activeBuffs.lootBoost) {
        amount = Math.floor(amount * (1 + activeBuffs.lootBoost / 100));
      }

      userProfile.balance += amount;
      cooldown.endsAt = new Date(Date.now() + 1); // still 5 min cooldown

      await Promise.all([cooldown.save(), userProfile.save()]);

      const successEmbed = new EmbedBuilder()
        .setTitle("🧪 Nether Quest Success!")
        .setDescription(
          "🔥 You fought through the Nether and found some Nether Sauce!"
        )
        .addFields(
          {
            name: "🎁 Loot Found",
            value: `${amount.toLocaleString()} 🧪`,
            inline: true,
          },
          {
            name: "📈 Old Balance",
            value: `${oldBalance.toLocaleString()} 🧪`,
            inline: true,
          },
          {
            name: "💰 New Balance",
            value: `${userProfile.balance.toLocaleString()} 🧪`,
            inline: true,
          }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // ===== Item Drop System Based on Rarity =====
      const dropRoll = Math.random() * 100;
      let dropRarity = null;

      if (dropRoll < 0.25) dropRarity = "Legendary"; //0.25%
      else if (dropRoll < 0.75) dropRarity = "Epic"; //0.5%
      else if (dropRoll < 1.75) dropRarity = "Rare"; //1%
      else if (dropRoll < 6.75) dropRarity = "Uncommon"; //5%
      else if (dropRoll < 16.75) dropRarity = "Common"; //10%

      if (dropRarity) {
        const itemsOfRarity = await Item.find({ rarity: dropRarity });

        if (itemsOfRarity.length > 0) {
          const randomItem =
            itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];

          const existingItem = userProfile.inventory.find(
            (i) => i.itemId === randomItem.itemId
          );

          if (existingItem) {
            existingItem.quantity += 1;
          } else {
            userProfile.inventory.push({
              itemId: randomItem.itemId,
              quantity: 1,
            });
          }

          await userProfile.save();

          const foundItemEmbed = new EmbedBuilder()
            .setTitle("\uD83C\uDF81 Nether Discovery!")
            .setDescription(
              `You discovered a ${randomItem.emoji} **${randomItem.name}**!\n*${randomItem.description}*`
            )
            .setColor(0x00ffcc)
            .setTimestamp();

          await interaction.followUp({ embeds: [foundItemEmbed] });
        }
      }
    } catch (error) {
      console.error(`Error handling /nether-quest: ${error}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "\u274C Something went wrong during your Nether Quest. Please try again later!",
        });
      } else {
        await interaction.editReply({
          content:
            "\u274C Something went wrong during your Nether Quest. Please try again later!",
        });
      }
    }
  },

  data: {
    name: "nether-quest",
    description: "Go on a quest for extra Nether Sauce!",
  },
};
