const UserProfile = require("../../schema/UserProfile");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  run: async ({ interaction }) => {
    const dailyAmount = 100000; // random between 1 and 100

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be executed from inside a server.",
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: false });

      let userProfile = await UserProfile.findOne({
        userId: interaction.member.id,
      });

      if (userProfile) {
        const lastDailyCollected =
          userProfile.lastDailyCollected?.toDateString();
        const currentDate = new Date().toDateString();
        if (lastDailyCollected === currentDate) {
          const now = new Date();
          const nextDaily = new Date(now);
          nextDaily.setUTCHours(24, 0, 0, 0); // Midnight UTC

          const secondsUntil = Math.floor(
            (nextDaily.getTime() - now.getTime()) / 1000
          );
          const cooldownTimestamp = Math.floor(nextDaily.getTime() / 1000); // UNIX time for Discord

          await interaction.editReply({
            content: `❌ You have already collected your dailies today.\n🕒 You can claim again <t:${cooldownTimestamp}:R>.`,
          });
          return;
        }
      } else {
        userProfile = new UserProfile({
          userId: interaction.member.id,
          balance: 0,
        });
      }

      const oldBalance = userProfile.balance;

      userProfile.balance += dailyAmount;
      userProfile.lastDailyCollected = new Date();
      await userProfile.save();

      // Random flavor text
      const flavorTexts = [
        "💎 You stumbled upon a hidden treasure!",
        "🎲 Luck was on your side today!",
        "🎁 A generous stranger gifted you some sauce!",
        "🧪 The Nether spirits blessed your wallet!",
        "🔥 Jackpot vibes today!",
      ];
      const randomFlavor =
        flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

      const embed = new EmbedBuilder()
        .setTitle("🎁 Daily Reward Collected!")
        .setDescription(randomFlavor)
        .addFields(
          {
            name: "🧪 Amount Collected",
            value: `${dailyAmount.toLocaleString()} 🧪`,
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error handling /daily: ${error}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(
          "❌ Something went wrong while collecting your daily. Please try again later."
        );
      } else if (!interaction.replied) {
        await interaction.editReply(
          "❌ Something went wrong while collecting your daily. Please try again later."
        );
      }
    }
  },

  data: {
    name: "daily",
    description: "Collect your daily reward!",
  },
};
