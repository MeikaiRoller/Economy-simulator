const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Bet = require("../../schema/Bet");
const UserProfile = require("../../schema/UserProfile");
const generateHorsesForRace = require("../../utils/generateHorsesForRace");
const { BETTING_CONFIG } = require("../../utils/bettingConfig");
const moment = require("moment-timezone");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("horse")
    .setDescription("Horse racing betting commands")
    .addSubcommand((sub) =>
      sub
        .setName("lineup")
        .setDescription("View the current hour's race lineup")
    )
    .addSubcommand((sub) =>
      sub
        .setName("bet")
        .setDescription("Place a bet on a horse for the current hour's race")
        .addStringOption((opt) =>
          opt
            .setName("horse")
            .setDescription("Name of the horse to bet on")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("mybets")
        .setDescription("View your active bets")
    ),

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only use horse betting inside a server!",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "lineup") {
      return handleLineup(interaction);
    }
    if (subcommand === "bet") {
      return handleBet(interaction);
    }
    if (subcommand === "mybets") {
      return handleMyBets(interaction);
    }
  },
};

async function handleLineup(interaction) {
  await interaction.deferReply();

  const now = moment().tz(BETTING_CONFIG.timezone);
  const raceHour = now.clone().startOf("hour").toDate();
  const horses = generateHorsesForRace(raceHour);

  const horseList = horses
    .map((h, idx) => `${idx + 1}. **${h.name}** — ${h.odds}x odds`)
    .join("\n");

  const cutoffMinute = BETTING_CONFIG.bettingCutoffMinute;
  const currentMinute = now.minute();
  const bettingOpen = currentMinute < cutoffMinute;

  const embed = new EmbedBuilder()
    .setTitle("🐎 Current Race Lineup")
    .setDescription(
      bettingOpen
        ? `Betting is **OPEN** until :${cutoffMinute.toString().padStart(2, "0")}`
        : `⚠️ Betting is **CLOSED** for this hour. Next race starts at the top of the hour!`
    )
    .addFields({
      name: "🏇 Horses",
      value: horseList,
      inline: false,
    })
    .addFields({
      name: "💰 Bet Details",
      value:
        `Stake: **$${BETTING_CONFIG.betAmount.toLocaleString()}**\n` +
        `House Rake: **${BETTING_CONFIG.houseRake}%**\n` +
        `Pool: Winner takes all (minus house cut)`,
      inline: false,
    })
    .setColor(bettingOpen ? 0x3498db : 0xe74c3c)
    .setFooter({
      text: bettingOpen
        ? `Use /horse bet <name> to place your bet`
        : `Race resolves at the top of the next hour`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBet(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const horseName = interaction.options.getString("horse");

  // Check if betting is still open
  const now = moment().tz(BETTING_CONFIG.timezone);
  const currentMinute = now.minute();
  const cutoffMinute = BETTING_CONFIG.bettingCutoffMinute;

  if (currentMinute >= cutoffMinute) {
    return interaction.editReply(
      `⚠️ Betting is closed for this hour! You can bet again after the race resolves at the top of the next hour.`
    );
  }

  const raceHour = now.clone().startOf("hour").toDate();
  const horses = generateHorsesForRace(raceHour);

  // Find the horse (case-insensitive)
  const horse = horses.find(
    (h) => h.name.toLowerCase() === horseName.toLowerCase()
  );

  if (!horse) {
    const availableHorses = horses.map((h) => h.name).join(", ");
    return interaction.editReply(
      `❌ Horse "${horseName}" not found in this race!\nAvailable horses: ${availableHorses}`
    );
  }

  // Check if user already has a bet for this hour
  const existingBet = await Bet.findOne({ userId, raceHour });
  if (existingBet) {
    return interaction.editReply(
      `❌ You already have a bet on **${existingBet.horse}** for this race!`
    );
  }

  // Check user balance
  const userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) {
    return interaction.editReply(
      `❌ You need to create a profile first using \`/create-profile\`!`
    );
  }

  if (userProfile.balance < BETTING_CONFIG.betAmount) {
    return interaction.editReply(
      `❌ You need **$${BETTING_CONFIG.betAmount.toLocaleString()}** to place a bet!\nYour balance: $${userProfile.balance.toLocaleString()}`
    );
  }

  // Deduct bet amount
  userProfile.balance -= BETTING_CONFIG.betAmount;
  await userProfile.save();

  // Create bet
  const bet = new Bet({
    userId,
    horse: horse.name,
    odds: horse.odds,
    betAmount: BETTING_CONFIG.betAmount,
    raceHour,
  });
  await bet.save();

  const embed = new EmbedBuilder()
    .setTitle("🎫 Bet Placed!")
    .setDescription(`You bet on **${horse.name}** (${horse.odds}x odds)`)
    .addFields(
      {
        name: "💰 Bet Amount",
        value: `$${BETTING_CONFIG.betAmount.toLocaleString()}`,
        inline: true,
      },
      {
        name: "📊 Potential Payout",
        value: `Depends on total pool and winners`,
        inline: true,
      },
      {
        name: "💵 New Balance",
        value: `$${userProfile.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setColor(0x00ff00)
    .setFooter({ text: "Race resolves at the top of the next hour!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleMyBets(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const now = moment().tz(BETTING_CONFIG.timezone);
  const currentRaceHour = now.clone().startOf("hour").toDate();

  const bets = await Bet.find({ userId, raceHour: currentRaceHour });

  if (bets.length === 0) {
    return interaction.editReply("❌ You don't have any active bets for the current race.");
  }

  const betList = bets
    .map(
      (bet) =>
        `🎫 **${bet.horse}** — ${bet.odds}x odds — $${bet.betAmount.toLocaleString()}`
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🎫 Your Active Bets")
    .setDescription(betList)
    .setColor(0x3498db)
    .setFooter({ text: "Good luck!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
