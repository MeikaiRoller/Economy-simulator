const Bet = require("../schema/Bet");
const UserProfile = require("../schema/UserProfile");
const generateHorsesForRace = require("./generateHorsesForRace");
const { BETTING_CONFIG } = require("./bettingConfig");
const moment = require("moment-timezone");

/**
 * Resolves an hourly horse race:
 * 1. Generates horses for the race
 * 2. Picks a winner based on weighted odds
 * 3. Calculates pool and distributes winnings
 * 4. Returns results for announcement
 */
async function resolveHorseRace(client) {
  try {
    // Calculate race hour (the hour that just ended)
    const now = moment().tz(BETTING_CONFIG.timezone);
    const raceHour = now.clone().subtract(1, "hour").startOf("hour").toDate();

    // Get all bets for this race
    const bets = await Bet.find({ raceHour }).lean();

    if (bets.length === 0) {
      console.log(`[Horse Race] No bets for race at ${raceHour}. Skipping.`);
      return null;
    }

    // Generate horses for this race (deterministic for the hour)
    const horses = generateHorsesForRace(raceHour);

    // Pick winner based on weighted odds
    const winner = pickWinner(horses);

    // Filter winning bets
    const winningBets = bets.filter(
      (bet) => bet.horse.toLowerCase() === winner.name.toLowerCase()
    );

    // Calculate pool
    const totalPool = bets.length * BETTING_CONFIG.betAmount;
    const houseRake = totalPool * (BETTING_CONFIG.houseRake / 100);
    const winnerPool = totalPool - houseRake;

    // Distribute winnings
    let payoutDetails = [];
    if (winningBets.length > 0) {
      const payoutPerWinner = Math.floor(winnerPool / winningBets.length);

      for (const bet of winningBets) {
        const user = await UserProfile.findOne({ userId: bet.userId });
        if (user) {
          user.balance += payoutPerWinner;
          await user.save();
          payoutDetails.push({
            userId: bet.userId,
            username: null, // Will be fetched for display
            payout: payoutPerWinner,
            betAmount: bet.betAmount,
          });
        }
      }
    }

    // Prepare results
    const results = {
      raceHour,
      horses,
      winner,
      stats: {
        totalBets: bets.length,
        totalPool,
        houseRake,
        winnerPool,
        winnersCount: winningBets.length,
      },
      payouts: payoutDetails,
    };

    // Announce results
    await announceResults(client, results);

    // Delete bets for this race (cleanup)
    await Bet.deleteMany({ raceHour });

    console.log(
      `[Horse Race] ✅ Race resolved: ${winner.name} won! ${winningBets.length} winners.`
    );

    return results;
  } catch (error) {
    console.error("[Horse Race] Error resolving race:", error);
    return null;
  }
}

/**
 * Pick a winner from horses based on weighted odds
 * Higher odds = lower win probability
 */
function pickWinner(horses) {
  let totalWeight = horses.reduce((sum, h) => sum + h.winProbability, 0);
  let random = Math.random() * totalWeight;

  for (const horse of horses) {
    random -= horse.winProbability;
    if (random <= 0) return horse;
  }

  return horses[horses.length - 1]; // Fallback
}

/**
 * Announce race results to Discord channel
 */
async function announceResults(client, results) {
  try {
    // Find channel by name "horse-race"
    const channel = client.channels.cache.find(
      (ch) => ch.name === "horse-race" && ch.isTextBased()
    );
    if (!channel) {
      console.error("[Horse Race] Channel 'horse-race' not found");
      return;
    }

    const { raceHour, horses, winner, stats, payouts } = results;

    // Build horse lineup
    const horseList = horses
      .map((h) => `${h.name.padEnd(15)} | ${h.odds}x odds`)
      .join("\n");

    // Build payout info
    let payoutInfo = "";
    if (stats.winnersCount > 0) {
      const payoutPerWinner = Math.floor(stats.winnerPool / stats.winnersCount);
      payoutInfo =
        `💰 **${stats.winnersCount}** winner${stats.winnersCount === 1 ? "" : "s"} each receive **$${payoutPerWinner.toLocaleString()}**\n` +
        `🏦 House rake: **$${stats.houseRake.toLocaleString()}** (${BETTING_CONFIG.houseRake}%)`;
    } else {
      payoutInfo = `🏦 House takes the entire pool: **$${stats.totalPool.toLocaleString()}**`;
    }

    const embed = {
      color: 0x8b4513, // Brown color for horse racing
      title: `🐎 Horse Race Results`,
      description: `**Race Time:** <t:${Math.floor(raceHour.getTime() / 1000)}:f>`,
      fields: [
        {
          name: "🏆 Winner",
          value: `**${winner.name}** (${winner.odds}x odds)`,
          inline: false,
        },
        {
          name: "📊 Race Lineup",
          value: `\`\`\`\n${horseList}\n\`\`\``,
          inline: false,
        },
        {
          name: "💵 Pool & Payouts",
          value:
            `📈 Total Pool: **$${stats.totalPool.toLocaleString()}**\n` +
            `📊 Total Bets: **${stats.totalBets}**\n` +
            payoutInfo,
          inline: false,
        },
      ],
      footer: {
        text: "Next race in 1 hour!",
      },
      timestamp: new Date().toISOString(),
    };

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[Horse Race] Error announcing results:", error);
  }
}

module.exports = resolveHorseRace;
