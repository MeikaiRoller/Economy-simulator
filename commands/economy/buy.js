const { ApplicationCommandOptionType } = require("discord.js");
const Shop = require("../../schema/Shop");
const Item = require("../../schema/Item");
const UserProfile = require("../../schema/UserProfile");
const Cooldown = require("../../schema/Cooldown");

module.exports = {
  data: {
    name: "buy",
    description: "Buy an item from the Nether Casino Shop!",
    options: [
      {
        name: "item_number",
        description: "The number of the item you want to buy (e.g., 1, 2, 3)",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only buy items inside a server!",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const commandName = "buy";
    const cooldownTime = 290 * 10000; // 5 seconds for buying (you can change it)

    let cooldown = await Cooldown.findOne({ userId, commandName });

    if (cooldown && Date.now() < cooldown.endsAt) {
      return interaction.editReply({
        content: `⏳ You are buying too fast! Try again in **${Math.ceil(
          (cooldown.endsAt - Date.now()) / 1000
        )}s**.`,
      });
    }

    if (!cooldown) {
      cooldown = new Cooldown({ userId, commandName });
    }

    cooldown.endsAt = new Date(Date.now() + cooldownTime);
    await cooldown.save();

    const itemNumber = interaction.options.getInteger("item_number");
    const guildId = interaction.guild.id;

    const shop = await Shop.findOne({});
    if (!shop || !shop.items.length) {
      return interaction.editReply({
        content: "❌ The shop is currently empty!",
      });
    }

    if (itemNumber < 1 || itemNumber > shop.items.length) {
      return interaction.editReply({ content: "❌ Invalid item number!" });
    }

    const selectedItemEntry = shop.items[itemNumber - 1];
    const item = await Item.findOne({ itemId: selectedItemEntry.itemId });

    if (!item) {
      return interaction.editReply({
        content: "❌ That item no longer exists!",
      });
    }

    let userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return interaction.editReply({
        content:
          "❌ You don't have a profile yet! Use `/create-profile` first.",
      });
    }

    if (userProfile.balance < item.price) {
      return interaction.editReply({
        content: `❌ You don't have enough 🧪 Nether Sauce to buy **${item.name}**!`,
      });
    }

    // Deduct money and add item
    userProfile.balance -= item.price;

    const existingItem = userProfile.inventory.find(
      (inv) => inv.itemId === item.itemId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      userProfile.inventory.push({ itemId: item.itemId, quantity: 1 });
    }

    await userProfile.save();

    await interaction.editReply({
      content: `✅ You bought **${
        item.name
      }** for **${item.price.toLocaleString()} 🧪**!`,
    });
  },
};
