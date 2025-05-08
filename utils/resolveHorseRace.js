const Bet = require("../schema/Bet");
const { BETTING_CONFIG } = require("./bettingConfig");
const moment = require("moment-timezone");


async function resolveHorseRace(client) {
  const now = moment().tz(BETTING_CONFIG.timezone);
  const raceDate = now.startOf("day").toDate();

  // Get today's bets
  const bets = await Bet.find({ date: raceDate });
  if (bets.length === 0) return console.log("🐴 No bets placed for today’s race.");

  // Get all horses that were bet on
  const horses = bets.map(bet => bet.horse);
  const winningHorse = horses[Math.floor(Math.random() * horses.length)];

  // Get all winners
  const winners = bets.filter(bet => bet.horse === winningHorse);

  const totalPot = BETTING_CONFIG.winningsPerPlayer * bets.length;
  const winningsPerUser = Math.floor(totalPot / winners.length);

  const resultMessage = `🏁 **Today's Horse Race Results!** 🏁
> 🎉 Winning Horse: **${winningHorse}**
> 💰 Total Pot: $${totalPot.toLocaleString()}
> 👥 Total Bettors: ${bets.length}
> 🏆 Winners: ${winners.length}
> 🪙 Each winner receives: $${winningsPerUser.toLocaleString()}`;

  // Optional: pay users here (e.g., update balances)

  // Announce in a channel
  const channel = client.channels.cache.find(ch => ch.name === "horse-race-results" && ch.isTextBased());
  if (channel) {
    await channel.send(resultMessage);
  } else {
    console.warn("❌ horse-race-results channel not found.");
  }

  // Clear all today's bets
  await Bet.deleteMany({ date: raceDate });

  console.log("✅ Horse race resolved for", raceDate.toDateString());
}

module.exports = resolveHorseRace;
