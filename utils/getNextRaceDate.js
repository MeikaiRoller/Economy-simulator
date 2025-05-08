const moment = require("moment-timezone");
const { BETTING_CONFIG } = require("./bettingConfig");

function getNextRaceDate() {
  const now = moment().tz(BETTING_CONFIG.timezone);
  const raceTimeToday = now.clone().hour(BETTING_CONFIG.cutoffHour).minute(0).second(0).millisecond(0);

  if (now.isBefore(raceTimeToday)) {
    return raceTimeToday.toDate(); // race is still upcoming today
  } else {
    return raceTimeToday.add(1, 'day').toDate(); // next race is tomorrow
  }
}

module.exports = { getNextRaceDate };
