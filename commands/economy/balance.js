const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "❌ You can only run this command inside a server!",
        ephemeral: true,
      });
      return;
    }

    const targetUser =
      interaction.options.getUser("target-user") || interaction.user;
    const targetUserId = targetUser.id;

    await interaction.deferReply();

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

      const balanceEmbed = new EmbedBuilder()
        .setTitle(`🧪 Nether Sauce Balance`)
        .setDescription(
          targetUserId === interaction.user.id
            ? `You currently have **${userProfile.balance.toLocaleString()} 🧪**!`
            : `<@${targetUserId}> has **${userProfile.balance.toLocaleString()} 🧪**!`
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setColor(0x00ffcc)
        .setTimestamp();

      await interaction.editReply({ embeds: [balanceEmbed] });
    } catch (error) {
      console.log(`Error handling /balance: ${error}`);
      await interaction.editReply({
        content:
          "❌ There was an error fetching the balance. Please try again later.",
      });
    }
  },

  data: {
    name: "balance",
    description: "Check your (or someone else's) Nether Sauce balance!",
    options: [
      {
        name: "target-user",
        description: "The user whose Nether Sauce balance you want to see.",
        type: ApplicationCommandOptionType.User,
      },
    ],
  },
};
