const Stock = require("../schema/Stock");
const StockPortfolio = require("../schema/StockPortfolio");
const UserProfile = require("../schema/UserProfile");

/**
 * Pays dividends to all stock holders
 * Run this monthly (or on a schedule in index.js)
 * Each shareholder gets 1.5% of stock's current price per share held
 */
async function payDividends() {
  try {
    console.log("💰 Processing dividend payouts...");

    const stocks = await Stock.find();
    let totalPayouts = 0;
    let payoutCount = 0;

    for (const stock of stocks) {
      if (!stock.volume || stock.volume <= 0) continue;

      // Dividend rate: 0.05% of current price per share per day (18% annual)
      const dividendPerShare = stock.price * 0.0005;

      // Find all portfolios holding this stock
      const portfolios = await StockPortfolio.find({
        "holdings.symbol": stock.symbol,
      });

      for (const portfolio of portfolios) {
        const holding = portfolio.holdings.find((h) => h.symbol === stock.symbol);
        if (!holding || holding.quantity <= 0) continue;

        // Calculate payout
        const dividendPayout = Math.floor(holding.quantity * dividendPerShare);
        if (dividendPayout <= 0) continue;

        // Add to user balance
        const user = await UserProfile.findOne({ userId: portfolio.userId });
        if (user) {
          user.balance += dividendPayout;
          await user.save();
          totalPayouts += dividendPayout;
          payoutCount++;
        }
      }
    }

    console.log(
      `✅ Dividend payout complete: ${payoutCount} shareholders paid $${totalPayouts.toLocaleString()} total`
    );
  } catch (err) {
    console.error("❌ Dividend payout failed:", err);
  }
}

module.exports = payDividends;
