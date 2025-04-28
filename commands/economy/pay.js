const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only run this command inside a server.",
        ephemeral: true,
      });
      return;
    }

    // Get target user and amount to transfer
    const targetUserId = interaction.options.getUser("target-user")?.id;
    const amount = interaction.options.getInteger("amount");

    // Ensure amount is positive and not zero
    if (amount <= 0) {
      await interaction.reply({
        content: "❌ You must enter a valid amount greater than 0!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Fetch user profiles
      const senderProfile = await UserProfile.findOne({
        userId: interaction.user.id,
      });

      const targetProfile = await UserProfile.findOne({
        userId: targetUserId,
      });

      // Check if sender has a profile
      if (!senderProfile) {
        await interaction.editReply({
          content:
            "❌ You don't have a profile yet! Use `/create-profile` to get started.",
        });
        return;
      }

      // Check if target user has a profile
      if (!targetProfile) {
        await interaction.editReply({
          content: "❌ The target user doesn't have a profile.",
        });
        return;
      }

      // Check if sender has enough balance
      if (senderProfile.balance < amount) {
        await interaction.editReply({
          content: `❌ You don't have enough Nether Sauce! Your current balance is ${senderProfile.balance}.`,
        });
        return;
      }

      // Proceed with the transaction
      senderProfile.balance -= amount;
      targetProfile.balance += amount;

      // Save both profiles
      await Promise.all([senderProfile.save(), targetProfile.save()]);

      // Send success message
      const successEmbed = new EmbedBuilder()
        .setTitle("💰 Payment Successful!")
        .setDescription(
          `${
            interaction.user.username
          } sent **${amount.toLocaleString()} 🧪** to <@${targetUserId}>.`
        )
        .addFields(
          {
            name: "Sender's New Balance",
            value: `${senderProfile.balance.toLocaleString()} 🧪`,
            inline: true,
          },
          {
            name: "Receiver's New Balance",
            value: `${targetProfile.balance.toLocaleString()} 🧪`,
            inline: true,
          }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({
        embeds: [successEmbed],
      });
    } catch (error) {
      console.error(`Error handling /pay: ${error}`);
      await interaction.editReply({
        content:
          "❌ Something went wrong while processing the payment. Please try again later!",
      });
    }
  },

  data: {
    name: "pay",
    description: "Pay another user with your Nether Sauce.",
    options: [
      {
        name: "target-user",
        description: "The user to pay.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "amount",
        description: "The amount of Nether Sauce to send.",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },
};
