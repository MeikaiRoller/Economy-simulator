module.exports = (message) => {
  //messageCreate
  if (message.author.bot) return;
  if (message.content == "hello") {
    message.reply("hello");
  }
};
