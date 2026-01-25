const generateHorsesForRace = require("./generateHorsesForRace");
const { BETTING_CONFIG } = require("./bettingConfig");
const moment = require("moment-timezone");

/**
 * Announces the upcoming race lineup at the start of the hour.
 */
async function announceHorseLineup(client) {
  try {
    const now = moment().tz(BETTING_CONFIG.timezone);
    const raceHour = now.startOf("hour").toDate();

    const channel = client.channels.cache.find(
      (ch) => ch.name === "horse-race" && ch.isTextBased()
    );
    if (!channel) {
      console.error("[Horse Race] Channel 'horse-race' not found for lineup announcement");
      return;
    }

    const horses = generateHorsesForRace(raceHour);
    const horseList = horses
      .map((h) => `${h.name.padEnd(15)} | ${h.odds}x odds`)
      .join("\n");

    const cutoff = BETTING_CONFIG.bettingCutoffMinute.toString().padStart(2, "0");
    const embed = {
      color: 0x3498db,
      title: "🐎 New Race Hour Open",
      description: `Bets are now open for this hour's race. Betting closes at :${cutoff}.`,
      fields: [
        {
          name: "Lineup",
          value: `\`\`\`\n${horseList}\n\`\`\``,
          inline: false,
        },
        {
          name: "Stake & Rake",
          value:
            `💰 Bet Amount: $${BETTING_CONFIG.betAmount.toLocaleString()}\n` +
            `🏦 House Rake: ${BETTING_CONFIG.houseRake}%\n` +
            `⏰ Race resolves at the top of the next hour`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await channel.send({ embeds: [embed] });
    console.log("[Horse Race] Announced new race lineup");
  } catch (error) {
    console.error("[Horse Race] Error announcing lineup:", error);
  }
}

module.exports = announceHorseLineup;
