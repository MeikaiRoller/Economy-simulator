const BETTING_CONFIG = {
  timezone: "America/Toronto",
  betAmount: 10_000, // Fixed bet amount
  houseRake: 15, // 15% house cut
  bettingCutoffMinute: 55, // Can't bet after :55 past the hour
};

module.exports = { BETTING_CONFIG };
  