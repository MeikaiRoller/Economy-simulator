const Bet = require("../../schema/Bet");
const { SlashCommandBuilder } = require("discord.js");
const { getNextRaceDate } = require("../../utils/getNextRaceDate");
const { BETTING_CONFIG } = require("../../utils/bettingConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("horse")
    .setDescription("Place your horse bet")
    .addStringOption(option =>
      option.setName("bet").setDescription("Horse name").setRequired(true)
    ),

  run: async ({ interaction }) => {
    const userId = interaction.user.id;
    const horse = interaction.options.getString("bet");
    const raceDate = getNextRaceDate();

    const existing = await Bet.findOne({ userId, date: raceDate });
    if (existing) {
      return interaction.reply({
        content: "❌ You’ve already bet on the next race!",
        ephemeral: true,
      });
    }

    await Bet.create({ userId, horse, date: raceDate });

    return interaction.reply({
      content: `✅ Your bet on **${horse}** has been placed for the **next race at 12 PM!**`,
    });
  },
};
