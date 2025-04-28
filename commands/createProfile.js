const UserProfile = require("../schema/UserProfile");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only create a profile inside a server!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    try {
      let userProfile = await UserProfile.findOne({ userId });

      if (userProfile) {
        await interaction.editReply({
          content: "🧪 You already have a profile!",
        });
        return;
      }

      userProfile = new UserProfile({
        userId: userId,
        balance: 0,
        lastDailyCollected: null,
      });

      await userProfile.save();

      await interaction.editReply({
        content: "✅ Profile created successfully! You can now start gambling!",
      });
    } catch (error) {
      console.error(`Error handling /create-profile: ${error}`);
      await interaction.editReply({
        content:
          "❌ There was an error creating your profile. Please try again later!",
      });
    }
  },

  data: {
    name: "create-profile",
    description: "Create your profile to start playing in the Nether Casino!",
  },
};
