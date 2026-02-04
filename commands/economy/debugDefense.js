module.exports = {
  data: {
    name: "debugdefense",
    description: "(disabled)"
  },
  run: ({ interaction }) => {
    interaction.reply({ content: "This command is disabled.", ephemeral: true });
  },
  deleted: true
};
