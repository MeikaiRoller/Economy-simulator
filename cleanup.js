const fs = require('fs');
const path = require('path');

const filesToDelete = [
  'commands/economy/adventure.js',
  'commands/economy/inventory.js',
  'commands/economy/nether.js',
  'commands/economy/buy.js',
  'commands/economy/stockBuy.js',
  'commands/economy/stockSell.js',
  'commands/economy/horseBet.js'
];

filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting ${file}:`, error.message);
  }
});

console.log('\n✨ Cleanup complete!');
