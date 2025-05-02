const { EmbedBuilder } = require("discord.js");
const Cooldown = require("../../schema/Cooldown");
const UserProfile = require("../../schema/UserProfile");

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

      const commandName = "beg";
      const userId = interaction.user.id;

      let cooldown = await Cooldown.findOne({ userId, commandName });
      if (cooldown && Date.now() < cooldown.endsAt) {
        const { default: prettyMs } = await import("pretty-ms");
        await interaction.editReply(
          `\u23F3 You're too ashamed to beg again so soon. Try again in **${prettyMs(
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

      const oldBalance = userProfile.balance;
      const amount = 100;
      userProfile.balance += amount;

      const cooldownTime = 5 * 60 * 1000; // 5 minutes in ms
      cooldown.endsAt = new Date(Date.now() + cooldownTime);

      await Promise.all([cooldown.save(), userProfile.save()]);

      const flavorTexts = [
        "🤫 Meikai mogged at you then dropped a few coins in your can.",
        "😱 A kind stranger felt bad for you. LMAO",
        "🥺 You throw it back... and it actually worked!",
        "😳 Hey 100 Nether Sauce is 100 Nether Sauce",
        "😇 The Nether gods gave you pity sauce.",
      ];
      const flavor =
        flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

      const embed = new EmbedBuilder()
        .setTitle("🙌 You Begged")
        .setDescription(flavor)
        .addFields(
          {
            name: "🧪 Sauce Earned",
            value: `${amount.toLocaleString()} 🧪`,
            inline: true,
          },
          {
            name: "💰 New Balance",
            value: `${userProfile.balance.toLocaleString()} 🧪`,
            inline: true,
          }
        )
        .setColor(0xffff66)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error handling /beg: ${error}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ Something went wrong during /beg. Please try again later.",
        });
      } else {
        await interaction.editReply({
          content:
            "❌ Something went wrong during /beg. Please try again later.",
        });
      }
    }
  },

  data: {
    name: "beg",
    description: "Beg for a tiny bit of Nether Sauce.",
  },
};
