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
        userId,
        balance: 50000,
        bankBalance: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        hp: 100,
        mana: 50,
        xp: 0,
        level: 1,
        buffs: {
          attackBoost: 0,
          defenseBoost: 0,
          magicBoost: 0,
          magicDefenseBoost: 0,
          criticalChance: 0,
          xpBoost: 0,
          healingBoost: 0,
          luckBoost: 0,
          lootBoost: 0,
          findRateBoost: 0,
          cooldownReduction: 0,
        },
        inventory: [],
        equipped: {
          weapon: null,
          head: null,
          chest: null,
          hands: null,
          feet: null,
          accessory: null,
        },
      });

      await userProfile.save();

      await interaction.editReply({
        content: "✅ Profile created successfully with $50,000 starting balance!",
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
    description: "Create your profile to start playing!",
  },
};
