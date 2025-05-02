const mongoose = require("mongoose");

const ShopSchema = new mongoose.Schema({
  expiresAt: { type: Date, required: true },
  items: [
    {
      itemId: { type: String, required: true },
    },
  ],
});

module.exports = mongoose.model("Shop", ShopSchema);
