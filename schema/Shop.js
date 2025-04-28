const mongoose = require("mongoose");

const ShopSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  items: [
    {
      itemId: { type: String, required: true },
      // you could also store local overrides (e.g. discountedPrice) here
    },
  ],
});

module.exports = mongoose.model("Shop", ShopSchema);
