require("dotenv").config();
const { REST, Routes, Client, IntentsBitField } = require("discord.js");

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds],
});

(async () => {
  try {
    console.log("🧹 Clearing all commands...");
    
    await client.login(process.env.TOKEN);
    const clientId = client.user.id;
    
    console.log(`Bot ID: ${clientId}`);
    
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    
    // Clear global commands
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("✅ Cleared global commands");
    
    // Clear guild commands for all guilds
    const guilds = await client.guilds.fetch();
    for (const guild of guilds.values()) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guild.id),
        { body: [] }
      );
      console.log(`✅ Cleared guild commands for ${guild.name}`);
    }
    
    console.log("✅ All commands cleared! Now restart your bot.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
