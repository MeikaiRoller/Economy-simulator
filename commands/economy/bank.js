const { SlashCommandBuilder } = require("discord.js");
const Bank = require("../../schema/Bank");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bank")
    .setDescription("Bank management system")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("balance")
        .setDescription("Check the current balance of the central bank")
    ),

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();

    if (sub === "balance") {
      let bank = await Bank.findOne({ name: "central" });

      if (!bank) {
        bank = new Bank({ name: "central", balance: 0 });
        await bank.save();
      }

      await interaction.editReply(
        `🏦 **Bank Balance:** $${bank.balance.toFixed(2)}`
      );
    }
  },
};
