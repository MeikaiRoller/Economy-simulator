const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const UserProfile = require("../../schema/UserProfile");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only run this command inside a server.",
        ephemeral: true,
      });
      return;
    }

    const game = interaction.options.getString("game");
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      await interaction.reply({
        content: "Please enter a valid amount to bet!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const userProfile = await UserProfile.findOne({
        userId: interaction.user.id,
      });

      if (!userProfile) {
        await interaction.editReply(
          "You don't have a profile yet! Create one first with /create-profile!"
        );
        return;
      }

      if (userProfile.balance < amount) {
        await interaction.editReply(
          `You don't have enough nether sauce! Your balance is ${userProfile.balance}.`
        );
        return;
      }

      switch (game) {
        case "coinflip":
          await playCoinflip(interaction, userProfile, amount);
          break;
        case "blackjack":
          await playBlackjack(interaction, userProfile, amount);
          break;
        case "highlow":
          await playHighLow(interaction, userProfile, amount);
          break;
        default:
          await interaction.editReply("Invalid game selection.");
        case "slots":
          await playSlots(interaction, userProfile, amount);
          break;
      }
    } catch (error) {
      console.log(`Error handling /casino: ${error}`);
      if (!interaction.replied) {
        await interaction.editReply(
          "An error occurred during your casino game."
        );
      }
    }
  },

  data: {
    name: "casino",
    description: "Play different casino games with your nether sauce!",
    options: [
      {
        name: "game",
        description: "Which game do you want to play?",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "Coinflip", value: "coinflip" },
          { name: "Blackjack", value: "blackjack" },
          { name: "High-Low", value: "highlow" },
        ],
      },
      {
        name: "amount",
        description: "How much nether sauce you want to bet.",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },
};

// ===============================================
// 🎲 Coinflip (Real version)
// ===============================================
async function playCoinflip(interaction, userProfile, amount) {
  const flip = Math.random();
  const playerWon = flip >= 0.5;

  if (playerWon) {
    userProfile.balance += amount;
  } else {
    userProfile.balance -= amount;
  }

  userProfile.gamesPlayed += 1;
  if (playerWon) userProfile.gamesWon += 1;
  else userProfile.gamesLost += 1;

  await userProfile.save();

  const result = playerWon ? "🪙 Heads" : "🪙 Tails";
  const outcome = playerWon ? "🎉 You Win!" : "❌ You Lose!";
  const winnings = playerWon
    ? `+${amount.toLocaleString()} 🧪`
    : `-${amount.toLocaleString()} 🧪`;

  const embed = new EmbedBuilder()
    .setTitle("🎲 Coinflip Result")
    .addFields(
      { name: "Result", value: result, inline: true },
      { name: "Outcome", value: outcome, inline: true },
      {
        name: "Bet Amount",
        value: `${amount.toLocaleString()} 🧪`,
        inline: false,
      },
      { name: "Winnings", value: winnings, inline: false },
      {
        name: "New Balance",
        value: `${userProfile.balance.toLocaleString()} 🧪`,
        inline: false,
      }
    )
    .setColor(playerWon ? 0x00ff00 : 0xff0000)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ===============================================
// 🃏 Blackjack (Real version - Hit/Stay Buttons)
// ===============================================
async function playBlackjack(interaction, userProfile, betAmount) {
  const deck = generateDeck();
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];

  let playerTotal = calculateHand(playerHand);
  let dealerTotal = calculateHand(dealerHand);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hit")
      .setLabel("Hit")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("stay")
      .setLabel("Stay")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = (hideDealer = true) => {
    return new EmbedBuilder()
      .setTitle("🃏 Blackjack")
      .addFields(
        {
          name: "Your Hand",
          value: `${playerHand
            .map((c) => c.name)
            .join(", ")}\nTotal: **${playerTotal}**`,
          inline: true,
        },
        {
          name: "Dealer's Hand",
          value: hideDealer
            ? `${dealerHand[0].name}, ❓`
            : `${dealerHand
                .map((c) => c.name)
                .join(", ")}\nTotal: **${dealerTotal}**`,
          inline: true,
        }
      )
      .setColor(0x2f3136)
      .setTimestamp();
  };

  await interaction.editReply({ embeds: [embed()], components: [row] });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    if (i.customId === "hit") {
      playerHand.push(drawCard(deck));
      playerTotal = calculateHand(playerHand);

      if (playerTotal > 21) {
        // BUST
        userProfile.balance -= betAmount;
        userProfile.gamesPlayed += 1;
        userProfile.gamesLost += 1;
        await userProfile.save();

        const bustEmbed = embed(false).setDescription("❌ You Busted!");
        await i.editReply({ embeds: [bustEmbed], components: [] });
        collector.stop();
        return;
      }

      await i.editReply({ embeds: [embed()], components: [row] });
    } else if (i.customId === "stay") {
      while (dealerTotal < 17) {
        dealerHand.push(drawCard(deck));
        dealerTotal = calculateHand(dealerHand);
      }

      let playerWon = false;
      if (dealerTotal > 21 || playerTotal > dealerTotal) {
        playerWon = true;
        userProfile.balance += betAmount;
      } else if (dealerTotal > playerTotal) {
        playerWon = false;
        userProfile.balance -= betAmount;
      } else {
        playerWon = null; // tie
      }

      if (playerWon !== null) {
        userProfile.gamesPlayed += 1;
        if (playerWon) userProfile.gamesWon += 1;
        else userProfile.gamesLost += 1;
      }

      await userProfile.save();

      const resultEmbed = embed(false).setDescription(
        playerWon === true
          ? "🎉 You Win!"
          : playerWon === false
          ? "❌ You Lose!"
          : "🤝 It's a Tie!"
      );

      await i.editReply({ embeds: [resultEmbed], components: [] });
      collector.stop();
    }
  });

  collector.on("end", async () => {
    // Nothing needed here
  });
}

function generateDeck() {
  const suits = ["♠️", "♥️", "♦️", "♣️"];
  const names = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const deck = [];
  for (const suit of suits) {
    for (const name of names) {
      const value =
        name === "A"
          ? 11
          : ["J", "Q", "K"].includes(name)
          ? 10
          : parseInt(name);
      deck.push({ name: `${name}${suit}`, value });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCard(deck) {
  return deck.pop();
}

function calculateHand(hand) {
  let total = hand.reduce((sum, card) => sum + card.value, 0);
  let aces = hand.filter((c) => c.name.startsWith("A")).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// ===============================================
// 🔮 High-Low (Real version - Double or Nothing)
// ===============================================
async function playHighLow(interaction, userProfile, amount) {
  let currentCard = Math.floor(Math.random() * 13) + 1;
  let winningsMultiplier = 1;
  let rounds = 0;
  const maxRounds = 5;

  const sendEmbed = async (desc, components) => {
    const embed = new EmbedBuilder()
      .setTitle("🔮 High-Low")
      .setDescription(desc)
      .setColor(0x2f3136)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [components] });
  };

  const buttons = (stage) => {
    if (stage === "guess") {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("higher")
          .setLabel("Higher")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("lower")
          .setLabel("Lower")
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("take")
          .setLabel("Take Winnings")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("double")
          .setLabel("Double or Nothing")
          .setStyle(ButtonStyle.Secondary)
      );
    }
  };

  await sendEmbed(
    `Your card is **${currentCard}**.\nHigher or Lower?`,
    buttons("guess")
  );

  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();
    let nextCard = Math.floor(Math.random() * 13) + 1;
    while (nextCard === currentCard) {
      nextCard = Math.floor(Math.random() * 13) + 1;
    }

    if (i.customId === "higher" || i.customId === "lower") {
      const guessHigher = i.customId === "higher";
      const correct =
        (guessHigher && nextCard > currentCard) ||
        (!guessHigher && nextCard < currentCard);

      if (!correct) {
        userProfile.balance -= amount;
        userProfile.gamesPlayed += 1;
        userProfile.gamesLost += 1;
        await userProfile.save();
        await sendEmbed(
          `❌ You lost!\nCard was **${currentCard}** → **${nextCard}**.`,
          new ActionRowBuilder()
        );
        collector.stop();
        return;
      }

      winningsMultiplier *= 2;
      currentCard = nextCard;
      rounds++;

      if (rounds >= maxRounds) {
        const winnings = amount * winningsMultiplier;
        userProfile.balance += winnings;
        userProfile.gamesPlayed += 1;
        userProfile.gamesWon += 1;
        await userProfile.save();
        await sendEmbed(
          `🎉 Max streak! You win **${winnings.toLocaleString()} 🧪**!`,
          new ActionRowBuilder()
        );
        collector.stop();
        return;
      }

      await sendEmbed(
        `✅ Correct!\nNew card: **${currentCard}**\nCurrent Winnings: **${(
          amount * winningsMultiplier
        ).toLocaleString()} 🧪**\n\nTake winnings or double again?`,
        buttons("decision")
      );
    } else if (i.customId === "take") {
      const winnings = amount * winningsMultiplier;
      userProfile.balance += winnings;
      userProfile.gamesPlayed += 1;
      userProfile.gamesWon += 1;
      await userProfile.save();
      await sendEmbed(
        `🎉 You took **${winnings.toLocaleString()} 🧪** winnings!`,
        new ActionRowBuilder()
      );
      collector.stop();
    } else if (i.customId === "double") {
      await sendEmbed(
        `Your card is **${currentCard}**.\nHigher or Lower?`,
        buttons("guess")
      );
    }
  });

  collector.on("end", async () => {
    // Timeout handled automatically
  });
}

async function playSlots(interaction, userProfile, amount) {
  const slotEmojis = ["🍒", "🍋", "🔔", "💎", "🍀", "🎰"];
  const spinTimes = 4;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const randomReel = () => [
    slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
    slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
    slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
  ];

  let reels = randomReel();
  await interaction.editReply({
    content: `🎰 Spinning...\n[ ${reels[0]} | ${reels[1]} | ${reels[2]} ]`,
    components: [],
  });

  for (let i = 0; i < spinTimes; i++) {
    await delay(700);
    reels = randomReel();
    await interaction.editReply({
      content: `🎰 Spinning...\n[ ${reels[0]} | ${reels[1]} | ${reels[2]} ]`,
    });
  }

  await delay(1000);
  reels = randomReel();

  const [first, second, third] = reels;
  let winnings = 0;
  let playerWon = false;

  if (first === second && second === third) {
    // Triple match special cases
    switch (first) {
      case "🍀":
        winnings = amount * 7; // Clover
        break;
      case "💎":
        winnings = amount * 20; // Diamond
        break;
      case "🎰":
        winnings = amount * 15; // Slot Machine
        break;
      case "🔔":
        winnings = amount * 5; // Bell
        break;
      case "🍒":
        winnings = amount * 4; // Cherry
        break;
      case "🍋":
        winnings = amount * 3; // Lemon
        break;
      default:
        winnings = amount * 3; // fallback
    }
    userProfile.balance += winnings;
    playerWon = true;
  } else if (first === second || first === third || second === third) {
    // Two match
    winnings = Math.floor(amount * 1.5);
    userProfile.balance += winnings;
    playerWon = true;
  } else {
    // No match
    userProfile.balance -= amount;
    playerWon = false;
  }

  userProfile.gamesPlayed += 1;
  if (playerWon) userProfile.gamesWon += 1;
  else userProfile.gamesLost += 1;

  await userProfile.save();

  const result = playerWon
    ? `🎉 YOU WON **${winnings.toLocaleString()} 🧪**!`
    : `❌ You lost **${amount.toLocaleString()} 🧪**.`;

  const finalEmbed = new EmbedBuilder()
    .setTitle("🎰 Slot Machine Result")
    .setDescription(
      `[ ${first} | ${second} | ${third} ]\n\n${result}\n\nNew Balance: **${userProfile.balance.toLocaleString()} 🧪**`
    )
    .setColor(playerWon ? 0x00ff00 : 0xff0000)
    .setTimestamp();

  await interaction.editReply({
    content: "",
    embeds: [finalEmbed],
  });
}
