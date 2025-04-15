import { run } from "@grammyjs/runner";
import axios from "axios";
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from "grammy";
import QuickChart from "quickchart-js";

// Define the shape of our session.
interface SessionData {
  pizzaCount: number;
  isProcessing: boolean;
  currentMenu: string; // To keep track of the current menu
}

// Flavor the context type to include sessions.
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(
  "7169920422:AAHKtKcPn6hfZrdTbHS7eRhV6-o5SQ0va8U"
);

// Install session middleware, and define the initial session value.
function initial(): SessionData {
  return { pizzaCount: 0, isProcessing: false, currentMenu: "main" };
}
bot.use(session({ initial }));

// Function to create a delay
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRequestWithLoader(
  message: string,
  ctx: MyContext,
  request: Promise<any>
) {
  let currentProgress = 0;

  const stages = [
    "🟩⬛️⬛️⬛️⬛️⬛️⬛️⬛️",
    "🟩🟩⬛️⬛️⬛️⬛️⬛️⬛️",
    "🟩🟩🟩⬛️⬛️⬛️⬛️⬛️",
    "🟩🟩🟩🟩⬛️⬛️⬛️⬛️",
    "🟩🟩🟩🟩🟩⬛️⬛️⬛️",
    "🟩🟩🟩🟩🟩🟩⬛️⬛️",
    "🟩🟩🟩🟩🟩🟩🟩⬛️",
    "🟩🟩🟩🟩🟩🟩🟩🟩",
    "⬛️🟩🟩🟩🟩🟩🟩🟩",
    "⬛️⬛️🟩🟩🟩🟩🟩🟩",
    "⬛️⬛️⬛️🟩🟩🟩🟩🟩",
    "⬛️⬛️⬛️⬛️🟩🟩🟩🟩",
    "⬛️⬛️⬛️⬛️⬛️🟩🟩🟩",
    "⬛️⬛️⬛️⬛️⬛️⬛️🟩🟩",
    "⬛️⬛️⬛️⬛️⬛️⬛️⬛️🟩",
    "⬛️⬛️⬛️⬛️⬛️⬛️⬛️⬛️",
    // "🟩🟩🟩🟩🟩⬛️⬛️",
    // "🟩🟩🟩🟩🟩⬛️⬛️",
  ];

  // const stages = [
  //   "🌕🌑🌑🌑🌑",
  //   "🌕🌕🌑🌑🌑",
  //   "🌕🌕🌕🌑🌑",
  //   "🌕🌕🌕🌕🌑",
  //   "🌕🌕🌕🌕🌕",
  //   "🌑🌕🌕🌕🌕",
  //   "🌑🌑🌕🌕🌕",
  //   "🌑🌑🌑🌕🌕",
  //   "🌑🌑🌑🌑🌕",
  //   "🌑🌑🌑🌑🌑",
  // ];

  // const stages = [
  //   "🌑🌒🌓🌔🌕🌖🌗🌘",
  //   "🌘🌑🌒🌓🌔🌕🌖🌗",
  //   "🌗🌘🌑🌒🌓🌔🌕🌖",
  //   "🌖🌗🌘🌑🌒🌓🌔🌕",
  //   "🌕🌖🌗🌘🌑🌒🌓🌔",
  //   "🌔🌕🌖🌗🌘🌑🌒🌓",
  //   "🌓🌔🌕🌖🌗🌘🌑🌒",
  //   "🌒🌓🌔🌕🌖🌗🌘🌑",
  // ];

  // const stages = ["🌍", "🌎", "🌏"];

  // const stages = ["◐", "◓", "◑", "◒"];
  // const stages = [
  //   "🕛",
  //   "🕐",
  //   "🕑",
  //   "🕒",
  //   "🕓",
  //   "🕔",
  //   "🕕",
  //   "🕖",
  //   "🕗",
  //   "🕘",
  //   "🕙",
  //   "🕚",
  // ];

  // const stages = ["⭐", "🌟", "💫", "✨"];

  // const stages = ["🔄", "🔃"];

  // const stages = ["🪙", "💰", "💸", "💵", "💲"];
  let stringToReturn = "";
  const interval = setInterval(() => {
    stringToReturn = `Loading: ${stages[currentProgress++ % stages.length]}`;
    ctx.editMessageText(
      `${message}


${stringToReturn}`
    );
  }, 500);

  await request;
  clearInterval(interval);

  return interval;
}

async function processRequest(ctx: MyContext) {
  //Call to api and show loader meanwhile
  await processRequestWithLoader(
    "Processing your pizza addition...",
    ctx,
    delay(15000)
  );
  // await ctx.editMessageText(
  //   `Processing your pizza addition... left ${getLoadingEmoji()}`
  // );
}

// Function to create a 15 seconds delay with a countdown
// async function delay15Seconds(ctx: MyContext) {
//   for (let i = 30; i > 0; i--) {
//     // const loadingEmoji = getLoadingEmoji(i);

//     await ctx.editMessageText(
//       `Processing your pizza addition... left ${loadingEmoji}`
//     );
//     await delay(500);
//   }
// }

const getMenu = (pizzaCount: number) => {
  return new InlineKeyboard()
    .text("Hunger", "hunger")
    .row()
    .text("Add Pizza", "add_pizza")
    .row()
    .text(`🍕 Count: ${pizzaCount}`, "pizza_count")
    .row()
    .text("Settings", "settings");
};

const getSettingsMenu = () => {
  return new InlineKeyboard()
    .text("Change Language", "change_language")
    .row()
    .text("Back to Main Menu", "main_menu");
};

bot.callbackQuery("hunger", async (ctx) => {
  const count = ctx.session.pizzaCount;
  await ctx.answerCallbackQuery("Hi");
  await ctx.editMessageText(`Your hunger level is ${count}!`, {
    reply_markup: getMenu(count),
  });
});

bot.callbackQuery("add_pizza", async (ctx) => {
  if (ctx.session.isProcessing) {
    await ctx.answerCallbackQuery("Pizza addition is already in process.");
    return;
  }

  ctx.session.isProcessing = true;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Processing your pizza addition...", {
    reply_markup: getMenu(ctx.session.pizzaCount),
  });

  await processRequest(ctx);

  ctx.session.pizzaCount++;
  ctx.session.isProcessing = false;

  await ctx.editMessageText("Pizza addition completed!", {
    reply_markup: getMenu(ctx.session.pizzaCount),
  });
});

bot.callbackQuery("pizza_count", async (ctx) => {
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("settings", async (ctx) => {
  ctx.session.currentMenu = "settings";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Settings Menu:", {
    reply_markup: getSettingsMenu(),
  });
});

bot.callbackQuery("change_language", async (ctx) => {
  await ctx.answerCallbackQuery("Feature not implemented yet.");
});

bot.callbackQuery("main_menu", async (ctx) => {
  ctx.session.currentMenu = "main";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Welcome! Here is your menu:", {
    reply_markup: getMenu(ctx.session.pizzaCount),
  });
});

bot.command("start", async (ctx) => {
  ctx.session.currentMenu = "main";
  await ctx.reply("Welcome! Here is your menu:", {
    reply_markup: getMenu(ctx.session.pizzaCount),
  });
});
function downsampleData(prices: any, targetPoints = 100) {
  const sampledPrices = [];
  const blockSize = Math.ceil(prices.length / targetPoints);

  for (let i = 0; i < prices.length; i += blockSize) {
    const block = prices.slice(i, i + blockSize);
    const avgTime =
      block.reduce((sum: any, item: any) => sum + item[0], 0) / block.length;
    const avgPrice =
      block.reduce((sum: any, item: any) => sum + item[1], 0) / block.length;
    sampledPrices.push([avgTime, avgPrice]);
  }

  return sampledPrices;
}

async function generatePriceGraph(prices: any) {
  const downsampledPrices = downsampleData(prices);

  const dates = downsampledPrices.map(
    (price) => new Date(price[0]).toISOString().split("T")[0]
  );
  const values = downsampledPrices.map((price) => price[1]);

  const chart = new QuickChart();
  chart.setConfig({
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "ETH/USD",
          data: values,
          borderColor: "green",
          borderWidth: 2,
          pointBackgroundColor: "green",
          pointBorderColor: "green",
          fill: false,
        },
      ],
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
          },
          title: {
            display: true,
            text: "Date",
            color: "white",
          },
          ticks: {
            color: "white",
          },
        },
        y: {
          title: {
            display: true,
            text: "Price (USD)",
            color: "white",
          },
          ticks: {
            color: "white",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "white",
          },
        },
        title: {
          display: true,
          text: "Ethereum Price in the Last Month",
          color: "white",
        },
      },
      layout: {
        padding: 20,
      },
      backgroundColor: "#333333",
    },
  });

  chart.setBackgroundColor("#333333");

  return chart.getShortUrl();
}

async function getHistoricalData() {
  const response = await axios.get(
    "https://api.coingecko.com/api/v3/coins/ethereum/market_chart",
    {
      params: {
        vs_currency: "usd",
        days: "10",
      },
    }
  );
  return response.data.prices;
}

bot.command("eth_price", async (ctx) => {
  ctx.reply("Generating price graph for Ethereum...");

  // Fetch historical data

  const prices = await getHistoricalData();

  // Generate the graph URL
  const imageUrl = await generatePriceGraph(prices);
  console.log("imageUrl", imageUrl);

  // Send the image to the user
  await ctx.replyWithPhoto(imageUrl);
});

run(bot);
