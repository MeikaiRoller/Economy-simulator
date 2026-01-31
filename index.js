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
  client.once("ready", async () => {
    console.log(`🟢 Logged in as ${client.user.tag}`);

    // 🧹 Remove deprecated slash commands
    const commandsToRemove = [
      "adventure",
      "adventure_deprecated",
      "nether_deprecated",
      "beg_deprecated",
      "buy_deprecated",
      "horse_deprecated",
      "inventory_deprecated",
      "stockbuy",
      "stocksell",
      "stockview",
      "stockportfolio",
      "stockbuy_deprecated",
      "stocksell_deprecated",
    ];
    try {
      if (!client.application) {
        console.warn("Client application is not available yet.");
      } else {
        await client.application.fetch();
        const globalCommands = await client.application.commands.fetch();
        for (const cmd of globalCommands.values()) {
          if (commandsToRemove.includes(cmd.name)) {
            try {
              await client.application.commands.delete(cmd.id);
              console.log(`🗑️ Removed global command: ${cmd.name}`);
            } catch (err) {
              if (err?.code !== 10063) {
                throw err;
              }
            }
          }
        }

        const guilds = await client.guilds.fetch();
        for (const guild of guilds.values()) {
          const guildCommands = await guild.commands.fetch();
          for (const cmd of guildCommands.values()) {
            if (commandsToRemove.includes(cmd.name)) {
              try {
                await guild.commands.delete(cmd.id);
                console.log(`🗑️ Removed guild command: ${cmd.name} (${guild.id})`);
              } catch (err) {
                if (err?.code !== 10063) {
                  throw err;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to remove deprecated commands:", error);
    }

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

    // 💰 Schedule dividend payouts daily at midnight
    cron.schedule("0 0 * * *", () => {
      console.log("💰 Processing daily dividend payouts...");
      payDividends().catch(console.error);
    }, {
      timezone: "America/Toronto"
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
