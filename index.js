"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const runner_1 = require("@grammyjs/runner");
const axios_1 = __importDefault(require("axios"));
const grammy_1 = require("grammy");
const quickchart_js_1 = __importDefault(require("quickchart-js"));
const bot = new grammy_1.Bot("7169920422:AAHKtKcPn6hfZrdTbHS7eRhV6-o5SQ0va8U");
// Install session middleware, and define the initial session value.
function initial() {
    return { pizzaCount: 0, isProcessing: false, currentMenu: "main" };
}
bot.use((0, grammy_1.session)({ initial }));
// Function to create a delay
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function processRequestWithLoader(message, ctx, request) {
    return __awaiter(this, void 0, void 0, function* () {
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
            ctx.editMessageText(`${message}


${stringToReturn}`);
        }, 500);
        yield request;
        clearInterval(interval);
        return interval;
    });
}
function processRequest(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        //Call to api and show loader meanwhile
        yield processRequestWithLoader("Processing your pizza addition...", ctx, delay(15000));
        // await ctx.editMessageText(
        //   `Processing your pizza addition... left ${getLoadingEmoji()}`
        // );
    });
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
const getMenu = (pizzaCount) => {
    return new grammy_1.InlineKeyboard()
        .text("Hunger", "hunger")
        .row()
        .text("Add Pizza", "add_pizza")
        .row()
        .text(`🍕 Count: ${pizzaCount}`, "pizza_count")
        .row()
        .text("Settings", "settings");
};
const getSettingsMenu = () => {
    return new grammy_1.InlineKeyboard()
        .text("Change Language", "change_language")
        .row()
        .text("Back to Main Menu", "main_menu");
};
bot.callbackQuery("hunger", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const count = ctx.session.pizzaCount;
    yield ctx.answerCallbackQuery("Hi");
    yield ctx.editMessageText(`Your hunger level is ${count}!`, {
        reply_markup: getMenu(count),
    });
}));
bot.callbackQuery("add_pizza", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.session.isProcessing) {
        yield ctx.answerCallbackQuery("Pizza addition is already in process.");
        return;
    }
    ctx.session.isProcessing = true;
    yield ctx.answerCallbackQuery();
    yield ctx.editMessageText("Processing your pizza addition...", {
        reply_markup: getMenu(ctx.session.pizzaCount),
    });
    yield processRequest(ctx);
    ctx.session.pizzaCount++;
    ctx.session.isProcessing = false;
    yield ctx.editMessageText("Pizza addition completed!", {
        reply_markup: getMenu(ctx.session.pizzaCount),
    });
}));
bot.callbackQuery("pizza_count", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCallbackQuery();
}));
bot.callbackQuery("settings", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.session.currentMenu = "settings";
    yield ctx.answerCallbackQuery();
    yield ctx.editMessageText("Settings Menu:", {
        reply_markup: getSettingsMenu(),
    });
}));
bot.callbackQuery("change_language", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCallbackQuery("Feature not implemented yet.");
}));
bot.callbackQuery("main_menu", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.session.currentMenu = "main";
    yield ctx.answerCallbackQuery();
    yield ctx.editMessageText("Welcome! Here is your menu:", {
        reply_markup: getMenu(ctx.session.pizzaCount),
    });
}));
bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.session.currentMenu = "main";
    yield ctx.reply("Welcome! Here is your menu:", {
        reply_markup: getMenu(ctx.session.pizzaCount),
    });
}));
function downsampleData(prices, targetPoints = 100) {
    const sampledPrices = [];
    const blockSize = Math.ceil(prices.length / targetPoints);
    for (let i = 0; i < prices.length; i += blockSize) {
        const block = prices.slice(i, i + blockSize);
        const avgTime = block.reduce((sum, item) => sum + item[0], 0) / block.length;
        const avgPrice = block.reduce((sum, item) => sum + item[1], 0) / block.length;
        sampledPrices.push([avgTime, avgPrice]);
    }
    return sampledPrices;
}
function generatePriceGraph(prices) {
    return __awaiter(this, void 0, void 0, function* () {
        const downsampledPrices = downsampleData(prices);
        const dates = downsampledPrices.map((price) => new Date(price[0]).toISOString().split("T")[0]);
        const values = downsampledPrices.map((price) => price[1]);
        const chart = new quickchart_js_1.default();
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
    });
}
function getHistoricalData() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get("https://api.coingecko.com/api/v3/coins/ethereum/market_chart", {
            params: {
                vs_currency: "usd",
                days: "10",
            },
        });
        return response.data.prices;
    });
}
bot.command("eth_price", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.reply("Generating price graph for Ethereum...");
    // Fetch historical data
    const prices = yield getHistoricalData();
    // Generate the graph URL
    const imageUrl = yield generatePriceGraph(prices);
    console.log("imageUrl", imageUrl);
    // Send the image to the user
    yield ctx.replyWithPhoto(imageUrl);
}));
(0, runner_1.run)(bot);
