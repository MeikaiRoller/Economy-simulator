require("dotenv").config();
const { Client, IntentsBitField } = require("discord.js");
const { CommandHandler } = require("djs-commander");
const mongoose = require("mongoose");
const path = require("path");
const cron = require("node-cron");
const resolveHorseRace = require("./utils/resolveHorseRace");
const announceHorseLineup = require("./utils/announceHorseLineup");
const simulateMarket = require("./events/simulateMarket/simulateMarket");
const payDividends = require("./utils/payDividends");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

  // 💸 Schedule horse race resolver at 12PM Toronto time once client is ready
  client.once("ready", () => {
    console.log(`🟢 Logged in as ${client.user.tag}`);

    // 🐎 Schedule hourly horse race resolver and lineup announcement
    cron.schedule(
      "0 * * * *",
      async () => {
        console.log("🏁 Running hourly horse race resolver...");
        await resolveHorseRace(client).catch(console.error);
        console.log("📢 Announcing new race lineup...");
        await announceHorseLineup(client).catch(console.error);
      },
      {
        timezone: "America/Toronto",
      }
    );

    // 💰 Schedule dividend payouts monthly (1st of month at midnight)
    cron.schedule("0 0 1 * *", () => {
      console.log("💰 Processing monthly dividend payouts...");
      payDividends().catch(console.error);
    });
  });

// 📈 Run market simulation every 5 mins
setInterval(() => {
  simulateMarket(client).catch(console.error);
  console.log(`Market simulated`);
}, 5 * 60 * 1000);

// 🧠 Load commands and events
new CommandHandler({
  client,
  eventsPath: path.join(__dirname, "events"),
  commandsPath: path.join(__dirname, "commands"),
});

// 🧬 Connect to Mongo and start the bot
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Database.");
  client.login(process.env.TOKEN);
})();
