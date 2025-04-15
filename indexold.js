"use strict";
// deno-lint-ignore-file no-explicit-any
/* eslint no-use-before-define: 0 */
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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const grammy_1 = require("grammy");
// import { Menu, MenuRange } from "https://deno.land/x/grammy_menu@v1.2.1/mod.ts"
// import { EthereumProvider } from "npm:@walletconnect/ethereum-provider@2.9.1"
const menu_1 = require("@grammyjs/menu");
const ethers_1 = require("ethers");
const ethereum_provider_1 = require("@walletconnect/ethereum-provider");
const index_1 = require("./utils/index");
const Pair_1 = __importDefault(require("./abis/Pair"));
const signInMenu = new menu_1.Menu("sign-in-menu")
    .text("Connect Wallet", connectWallet);
const mainMenu = new menu_1.Menu("main-menu")
    .text("Swap Tokens", swapTokensMenu)
    // .text("Liq pool", (ctx) => ctx.reply("liq-pool")).row()
    // .text("Sign message", signMessage).row()
    .text("Liquidity Pools", liquidityPoolsMenu).row()
    .text("VersaAI", aiChatMenu).row()
    .url("Top-Up with FIAT", "https://t.me/versatest_bot/top_up").row()
    .text("Sign Out", signOut);
const aiMenu = new menu_1.Menu("ai-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.session.waitingForAIPrompt = false;
        yield ctx.editMessageText(ctx.session.wcConnected ? `💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\`` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? mainMenu : signInMenu, parse_mode: "MarkdownV2" });
    }));
    return range;
});
const wcMenu = new menu_1.Menu("wc-menu")
    .dynamic((ctx) => {
    const range = new menu_1.MenuRange();
    range.url("Metamask", (0, index_1.getDeepLink)(ctx.session.wcUri, "metamask") || "https://versadex.finance").row();
    // range.url("Trust", getDeepLink(ctx.session.wcUri!, "trust") || "https://versadex.finance").row();
    range.back("Back");
    return range;
});
const confirmSwapMenu = new menu_1.Menu("confirm-swap-menu");
const swapTransactionSubmittedMenu = new menu_1.Menu("transaction-submitted-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
                yield signOut(ctx);
                return;
            }
            yield swapTokensMenu(ctx);
        }
        catch (error) {
            console.error(`[ERROR] Back to Swap Menu from Transaction Submitted Menu: `, error);
        }
    }));
    return range;
});
const errorMenu = new menu_1.Menu("error-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
                yield signOut(ctx);
                return;
            }
            yield ctx.editMessageText(`💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            console.error(`[ERROR] Back to Main Menu from Error Menu: `, error);
        }
    }));
    return range;
});
const poolsMenu = new menu_1.Menu("pools-menu")
    .dynamic((ctx) => {
    const range = new menu_1.MenuRange();
    const nOfPools = ctx.session.pools.length;
    for (let i = 0; i < nOfPools; i++) {
        const pool = ctx.session.pools[i];
        range.text(`${pool.token0.symbol}/${pool.token1.symbol} - ${(0, index_1.roundToFirstNonZeroDecimal)(ethers_1.ethers.utils.formatEther(pool.balance))} LP Tokens`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // Calculate data here to get the most recent information
                const provider = new ethers_1.ethers.providers.Web3Provider(ctx.session.wcProvider);
                const pairContract = new ethers_1.ethers.Contract(pool.pairAddress, Pair_1.default, provider);
                const totalSupply = yield pairContract.totalSupply();
                const percentageOfOwnership = (Number(ethers_1.ethers.utils.formatEther(pool.balance)) / Number(ethers_1.ethers.utils.formatEther(totalSupply)));
                const reserves = yield pairContract.getReserves();
                let token0Reserve = undefined;
                let token1Reserve = undefined;
                if (pool.token0.address < pool.token1.address) {
                    const re0 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token0.decimals || -1) + '})?');
                    token0Reserve = Number(String(Number(ethers_1.ethers.utils.formatEther(reserves._reserve0)) * percentageOfOwnership).match(re0)[0]);
                    const re1 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token1.decimals || -1) + '})?');
                    token1Reserve = Number(String(Number(ethers_1.ethers.utils.formatEther(reserves._reserve1)) * percentageOfOwnership).match(re1)[0]);
                }
                else {
                    const re0 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token0.decimals || -1) + '})?');
                    token0Reserve = Number(String(Number(ethers_1.ethers.utils.formatEther(reserves._reserve1)) * percentageOfOwnership).match(re0)[0]);
                    const re1 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token1.decimals || -1) + '})?');
                    token1Reserve = Number(String(Number(ethers_1.ethers.utils.formatEther(reserves._reserve0)) * percentageOfOwnership).match(re1)[0]);
                }
                ctx.session.selectedPool = Object.assign(Object.assign({}, pool), { token0Reserve,
                    token1Reserve,
                    totalSupply,
                    percentageOfOwnership });
                ctx.session.removePoolData.amount0Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(token0Reserve)).mul(50).div(100)));
                ctx.session.removePoolData.amount1Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(token1Reserve)).mul(50).div(100)));
                ctx.session.removePoolData.balance = pool.balance;
                ctx.session.removePoolData.percentage = 50;
                yield ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu });
            }
            catch (error) {
                console.error(`[ERROR] Selecting pool: `, error);
            }
        })).row();
    }
    range.text("Create Pool", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Create Pool: `, error);
        }
    })).row();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield ctx.editMessageText(`💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            console.error(`[ERROR] Back to Main Menu from Swap Menu: ${error}`);
        }
    }));
    return range;
});
const createPoolSuccessMenu = new menu_1.Menu("create-pool-approve-success-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Create Pool Success Menu: `, error);
        }
    }));
    return range;
});
const addToPoolApproveSuccessMenu = new menu_1.Menu("add-to-pool-approve-success-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (ctx.session.selectedPool) {
                yield ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error);
        }
    }));
    return range;
});
const addToPoolSuccessMenu = new menu_1.Menu("add-to-pool-success-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.selectedPool = null;
            ctx.session.addToPoolData.pairAddress = index_1.NULL_ADDRESS;
            yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error);
        }
    }));
    return range;
});
const removePoolSuccessMenu = new menu_1.Menu("remove-pool-success-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.selectedPool = null;
            ctx.session.removePoolData.amount0Desired = 0;
            ctx.session.removePoolData.amount1Desired = 0;
            ctx.session.removePoolData.balance = ethers_1.ethers.BigNumber.from(0);
            ctx.session.removePoolData.percentage = 50;
            yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error);
        }
    }));
    return range;
});
const positionPoolMenu = new menu_1.Menu("position-pool-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Add", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (ctx.session.pendingTx) {
                console.log("[INFO] Transaction pending...");
                return;
            }
            if (ctx.session.selectedPool) {
                if (ctx.session.addToPoolData.pairAddress === index_1.NULL_ADDRESS) {
                    ctx.session.addToPoolData = {
                        pairAddress: ctx.session.selectedPool.pairAddress,
                        token0: ctx.session.selectedPool.token0,
                        token1: ctx.session.selectedPool.token1,
                        amount0Desired: "0",
                        amount1Desired: "0",
                        slippage: 10
                    };
                }
                yield ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Adding to Pool Menu: `, error);
        }
    }));
    range.text("Remove", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        if (ctx.session.selectedPool) {
            yield ctx.editMessageText(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu });
        }
        else {
            yield ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
        }
    })).row();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.selectedPool = null;
            ctx.session.addToPoolData.pairAddress = index_1.NULL_ADDRESS;
            yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Create Pool Menu: `, error);
        }
    }));
    return range;
});
const createPoolMenu = new menu_1.Menu("create-pool-menu")
    .dynamic((ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const range = new menu_1.MenuRange();
    let allowance = undefined;
    if (ctx.session.createPoolData.token0.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase()) {
        console.log(`[INFO] Checking allowance for ${ctx.session.createPoolData.token0.symbol}...`);
        allowance = (yield (0, index_1.getAllowance)(ctx, ctx.session.createPoolData.token0.address));
        console.log(`[INFO] Allowance for ${ctx.session.createPoolData.token0.symbol}: ${allowance}`);
    }
    else if (ctx.session.createPoolData.token1.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase()) {
        console.log(`[INFO] Checking allowance for ${ctx.session.createPoolData.token1.symbol}...`);
        allowance = (yield (0, index_1.getAllowance)(ctx, ctx.session.createPoolData.token1.address));
        console.log(`[INFO] Allowance for ${ctx.session.createPoolData.token1.symbol}: ${allowance}`);
    }
    range.text(`${ctx.session.createPoolData.token0.symbol}`);
    range.text("/");
    range.text(`${ctx.session.createPoolData.token1.symbol}`).row();
    range.text(`Pooled ${ctx.session.createPoolData.token0.symbol}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForPoolAmount0 = true;
            yield ctx.editMessageText(`Enter an amount of ${ctx.session.createPoolData.token0.symbol} to pool: `, { reply_markup: changePooledAmountMenu });
        }
        catch (error) {
            ctx.session.waitingForPoolAmount0 = false;
            console.error(`[ERROR] Changing desired Amount0: `, error);
        }
    }));
    range.text(`Pooled ${ctx.session.createPoolData.token1.symbol}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForPoolAmount1 = true;
            yield ctx.editMessageText(`Enter an amount of ${ctx.session.createPoolData.token1.symbol} to pool: `, { reply_markup: changePooledAmountMenu });
        }
        catch (error) {
            ctx.session.waitingForPoolAmount1 = false;
            console.error(`[ERROR] Changing desired Amount1: `, error);
        }
    })).row();
    if (ctx.session.createPoolData.token0.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals))) {
        // Approve token0
        console.log(`[INFO] Amount0Desired: ${ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals)}`);
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.approve)(ctx, undefined, createPoolSuccessMenu, true, ctx.session.createPoolData.token0, ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals));
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Creating Pool: `, error);
            }
        })).row();
    }
    else if (ctx.session.createPoolData.token1.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals))) {
        // Approve token1
        console.log(`[INFO] Amount1Desired: ${ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals)}`);
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.approve)(ctx, undefined, createPoolSuccessMenu, true, ctx.session.createPoolData.token1, ethers_1.ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals));
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Creating Pool: `, error);
            }
        })).row();
    }
    else {
        range.text("Create Pool", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                // await createPool(ctx)
                yield (0, index_1.createPool)(ctx, createPoolSuccessMenu, ctx.session.createPoolData);
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Creating Pool: `, error);
            }
        })).row();
    }
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Create Pool Menu: `, error);
        }
    }));
    return range;
}));
const addToPoolMenu = new menu_1.Menu("add-to-pool-menu")
    .dynamic((ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const range = new menu_1.MenuRange();
    let allowance = undefined;
    if (ctx.session.addToPoolData.token0.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase()) {
        console.log(`[INFO] Checking allowance for ${ctx.session.addToPoolData.token0.symbol}...`);
        allowance = (yield (0, index_1.getAllowance)(ctx, ctx.session.addToPoolData.token0.address));
        console.log(`[INFO] Allowance for ${ctx.session.addToPoolData.token0.symbol}: ${allowance}`);
    }
    else if (ctx.session.addToPoolData.token1.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase()) {
        console.log(`[INFO] Checking allowance for ${ctx.session.addToPoolData.token1.symbol}...`);
        allowance = (yield (0, index_1.getAllowance)(ctx, ctx.session.addToPoolData.token1.address));
        console.log(`[INFO] Allowance for ${ctx.session.addToPoolData.token1.symbol}: ${allowance}`);
    }
    range.text(`${ctx.session.addToPoolData.token0.symbol}`);
    range.text("/");
    range.text(`${ctx.session.addToPoolData.token1.symbol}`).row();
    range.text(`Pooled ${ctx.session.addToPoolData.token0.symbol}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForAddPoolAmount0 = true;
            yield ctx.editMessageText(`Enter an amount of ${ctx.session.addToPoolData.token0.symbol} to pool: `, { reply_markup: changePooledAddAmountMenu });
        }
        catch (error) {
            ctx.session.waitingForAddPoolAmount0 = false;
            console.error(`[ERROR] Changing desired Amount0: `, error);
        }
    }));
    range.text(`Pooled ${ctx.session.addToPoolData.token1.symbol}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForAddPoolAmount1 = true;
            yield ctx.editMessageText(`Enter an amount of ${ctx.session.addToPoolData.token1.symbol} to pool: `, { reply_markup: changePooledAddAmountMenu });
        }
        catch (error) {
            ctx.session.waitingForAddPoolAmount1 = false;
            console.error(`[ERROR] Changing desired Amount1: `, error);
        }
    })).row();
    if (ctx.session.addToPoolData.token0.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals))) {
        // Approve token0
        console.log(`[INFO] Amount0Desired: ${ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals)}`);
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.approve)(ctx, undefined, addToPoolApproveSuccessMenu, true, ctx.session.addToPoolData.token0, ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals));
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Adding to Pool: `, error);
            }
        })).row();
    }
    else if (ctx.session.addToPoolData.token1.address.toLowerCase() !== index_1.ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals))) {
        // Approve token1
        console.log(`[INFO] Amount1Desired: ${ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals)}`);
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.approve)(ctx, undefined, addToPoolApproveSuccessMenu, true, ctx.session.addToPoolData.token1, ethers_1.ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals));
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Adding to Pool: `, error);
            }
        })).row();
    }
    else {
        range.text("Add", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                // await createPool(ctx)
                yield (0, index_1.createPool)(ctx, addToPoolSuccessMenu, ctx.session.addToPoolData);
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Adding to Pool: `, error);
            }
        })).row();
    }
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (ctx.session.selectedPool) {
                yield ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error);
        }
    }));
    return range;
}));
const swapMenu = new menu_1.Menu("swap-menu")
    .dynamic((ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const range = new menu_1.MenuRange();
    const fromSymbol = ctx.session.swapData.fromToken.symbol;
    const toSymbol = ctx.session.swapData.toToken.symbol;
    const allowance = yield (0, index_1.getAllowance)(ctx);
    range.text(fromSymbol);
    range.text("→", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const fromToken = ctx.session.swapData.fromToken;
            ctx.session.swapData.fromToken = ctx.session.swapData.toToken;
            ctx.session.swapData.toToken = fromToken;
            yield swapTokensMenu(ctx);
        }
        catch (error) {
            console.error(`[ERROR] Swap Menu: ${error}`);
        }
    }));
    range.text(toSymbol).row();
    range.text("Change amount", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForSwapAmount = true;
            yield ctx.editMessageText(ctx.session.wcConnected ? `Enter an amount to swap\\:` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? changeSwapAmountMenu : signInMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            ctx.session.waitingForSwapAmount = false;
            console.error(`[ERROR] Changing Swap amount: ${error}`);
        }
    }));
    range.text("Change slippage", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForSwapSlippage = true;
            yield ctx.editMessageText(ctx.session.wcConnected ? `Enter desired slippage \\[current: ${(0, index_1.formatMD)(String(ctx.session.swapData.slippage / 10))}\\%\\]\\:` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? changeSlippageAmountMenu : signInMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            ctx.session.waitingForSwapSlippage = false;
            console.error(`[ERROR] Changing Slippage: ${error}`);
        }
    })).row();
    if (ctx.session.swapData.fromToken.address !== index_1.ETH_DATA.address && allowance && allowance.lt(ethers_1.ethers.utils.parseUnits(ctx.session.swapData.fromAmount, ctx.session.swapData.fromToken.decimals))) {
        // From is not ETH and allowance is less than fromAmount
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.approve)(ctx, confirmSwapMenu, swapTransactionSubmittedMenu);
            }
            catch (error) {
                ctx.session.pendingTx = false;
                yield swapTokensMenu(ctx);
                console.error(`[ERROR] Approving tokens: `, error);
            }
        })).row();
    }
    else {
        range.text("Swap", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                if (ctx.session.swapData.fromAmount === "0") {
                    yield ctx.reply("Please enter an amount to swap");
                    return;
                }
                yield (0, index_1.swap)(ctx, confirmSwapMenu, swapTransactionSubmittedMenu);
            }
            catch (error) { // TODO
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Swapping tokens: `, error);
                if (error.message.includes("User rejected the transaction")) {
                    yield swapTokensMenu(ctx);
                }
                else {
                    yield ctx.editMessageText(`💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" });
                }
            }
        })).row();
    }
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield ctx.editMessageText(`💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            console.error(`[ERROR] Back to Main Menu from Swap Menu: ${error}`);
        }
    }));
    return range;
}));
const changePooledAmountMenu = new menu_1.Menu("change-pooled-amount-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.session.waitingForPoolAmount0 = false;
        ctx.session.waitingForPoolAmount1 = false;
        try {
            yield ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Back to Pools Menu from Change Pooled Amount Menu: `, error);
        }
    }));
    return range;
});
const changePooledAddAmountMenu = new menu_1.Menu("change-pooled-add-amount-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.session.waitingForAddPoolAmount0 = false;
        ctx.session.waitingForAddPoolAmount1 = false;
        try {
            if (ctx.session.selectedPool) {
                yield ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Position Menu from Change Pooled Amount Menu: `, error);
        }
    }));
    return range;
});
const changeSwapAmountMenu = new menu_1.Menu("change-swap-amount-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForSwapAmount = false;
            yield swapTokensMenu(ctx);
        }
        catch (error) {
            console.error(`[ERROR] Back to Swap Menu from Amount Menu: `, error);
        }
    }));
    return range;
});
const changeSlippageAmountMenu = new menu_1.Menu("change-slippage-amount-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForSwapSlippage = false;
            yield swapTokensMenu(ctx);
        }
        catch (error) {
            console.error(`[ERROR] Back to Swap Menu from Slippage Amount Menu: ${error}`);
        }
    }));
    return range;
});
const removePoolApprovalSuccessMenu = new menu_1.Menu("remove-pool-approve-success-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Close", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (ctx.session.selectedPool) {
                yield ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu });
            }
            else {
                yield ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error);
        }
    }));
    return range;
});
const removePoolMenu = new menu_1.Menu("remove-pool-menu")
    .dynamic((ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const range = new menu_1.MenuRange();
    let allowance = undefined;
    if (ctx.session.selectedPool) {
        console.log(`[INFO] Checking allowance for VERSA-V2...`);
        allowance = (yield (0, index_1.getAllowance)(ctx, ctx.session.selectedPool.pairAddress));
        console.log(`[INFO] Allowance for VERSA-V2: ${allowance}`);
        console.log(`[INFO] LP Tokens to burn ${ctx.session.removePoolData.balance.mul(ethers_1.ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100)}`);
    }
    range.text("25%", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            if (ctx.session.selectedPool) {
                ctx.session.removePoolData.percentage = 25;
                ctx.session.removePoolData.amount0Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(25).div(100)));
                ctx.session.removePoolData.amount1Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(25).div(100)));
                yield ctx.editMessageText(`Removing 25% of your position in ${(_a = ctx.session.selectedPool) === null || _a === void 0 ? void 0 : _a.token0.symbol}/${(_b = ctx.session.selectedPool) === null || _b === void 0 ? void 0 : _b.token1.symbol}\n\nPooled ${(_c = ctx.session.selectedPool) === null || _c === void 0 ? void 0 : _c.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_d = ctx.session.selectedPool) === null || _d === void 0 ? void 0 : _d.token0Reserve)}\nPooled ${(_e = ctx.session.selectedPool) === null || _e === void 0 ? void 0 : _e.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_f = ctx.session.selectedPool) === null || _f === void 0 ? void 0 : _f.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${(_g = ctx.session.selectedPool) === null || _g === void 0 ? void 0 : _g.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${(_h = ctx.session.selectedPool) === null || _h === void 0 ? void 0 : _h.token1.symbol}`, { reply_markup: removePoolMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Removing Pool: `, error);
        }
    }));
    range.text("50%", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        var _j, _k, _l, _m, _o, _p, _q, _r;
        try {
            if (ctx.session.selectedPool) {
                ctx.session.removePoolData.percentage = 50;
                ctx.session.removePoolData.amount0Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(50).div(100)));
                ctx.session.removePoolData.amount1Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(50).div(100)));
                yield ctx.editMessageText(`Removing 50% of your position in ${(_j = ctx.session.selectedPool) === null || _j === void 0 ? void 0 : _j.token0.symbol}/${(_k = ctx.session.selectedPool) === null || _k === void 0 ? void 0 : _k.token1.symbol}\n\nPooled ${(_l = ctx.session.selectedPool) === null || _l === void 0 ? void 0 : _l.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_m = ctx.session.selectedPool) === null || _m === void 0 ? void 0 : _m.token0Reserve)}\nPooled ${(_o = ctx.session.selectedPool) === null || _o === void 0 ? void 0 : _o.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_p = ctx.session.selectedPool) === null || _p === void 0 ? void 0 : _p.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${(_q = ctx.session.selectedPool) === null || _q === void 0 ? void 0 : _q.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${(_r = ctx.session.selectedPool) === null || _r === void 0 ? void 0 : _r.token1.symbol}`, { reply_markup: removePoolMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Removing Pool: `, error);
        }
    })).row();
    range.text("75%", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        var _s, _t, _u, _v, _w, _x, _y, _z;
        try {
            if (ctx.session.selectedPool) {
                ctx.session.removePoolData.percentage = 75;
                ctx.session.removePoolData.amount0Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(75).div(100)));
                ctx.session.removePoolData.amount1Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(75).div(100)));
                yield ctx.editMessageText(`Removing 75% of your position in ${(_s = ctx.session.selectedPool) === null || _s === void 0 ? void 0 : _s.token0.symbol}/${(_t = ctx.session.selectedPool) === null || _t === void 0 ? void 0 : _t.token1.symbol}\n\nPooled ${(_u = ctx.session.selectedPool) === null || _u === void 0 ? void 0 : _u.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_v = ctx.session.selectedPool) === null || _v === void 0 ? void 0 : _v.token0Reserve)}\nPooled ${(_w = ctx.session.selectedPool) === null || _w === void 0 ? void 0 : _w.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_x = ctx.session.selectedPool) === null || _x === void 0 ? void 0 : _x.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${(_y = ctx.session.selectedPool) === null || _y === void 0 ? void 0 : _y.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${(_z = ctx.session.selectedPool) === null || _z === void 0 ? void 0 : _z.token1.symbol}`, { reply_markup: removePoolMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Removing Pool: `, error);
        }
    }));
    range.text("100%", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        var _0, _1, _2, _3, _4, _5, _6, _7;
        try {
            if (ctx.session.selectedPool) {
                ctx.session.removePoolData.percentage = 100;
                ctx.session.removePoolData.amount0Desired = ctx.session.selectedPool.token0Reserve;
                ctx.session.removePoolData.amount1Desired = ctx.session.selectedPool.token1Reserve;
                yield ctx.editMessageText(`Removing 100% of your position in ${(_0 = ctx.session.selectedPool) === null || _0 === void 0 ? void 0 : _0.token0.symbol}/${(_1 = ctx.session.selectedPool) === null || _1 === void 0 ? void 0 : _1.token1.symbol}\n\nPooled ${(_2 = ctx.session.selectedPool) === null || _2 === void 0 ? void 0 : _2.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_3 = ctx.session.selectedPool) === null || _3 === void 0 ? void 0 : _3.token0Reserve)}\nPooled ${(_4 = ctx.session.selectedPool) === null || _4 === void 0 ? void 0 : _4.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)((_5 = ctx.session.selectedPool) === null || _5 === void 0 ? void 0 : _5.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${(_6 = ctx.session.selectedPool) === null || _6 === void 0 ? void 0 : _6.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${(_7 = ctx.session.selectedPool) === null || _7 === void 0 ? void 0 : _7.token1.symbol}`, { reply_markup: removePoolMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Removing Pool: `, error);
        }
    })).row();
    range.text("Manual Percentage", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForRemovePoolAmount = true;
            yield ctx.editMessageText("Enter a percentage to remove: ", { reply_markup: changePercentageRemovePoolMenu });
        }
        catch (error) {
            ctx.session.waitingForRemovePoolAmount = false;
            console.error(`[ERROR] Manual Percentage: `, error);
        }
    })).row();
    if (allowance && allowance.lt(ctx.session.removePoolData.balance.mul(ethers_1.ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100))) {
        range.text("Approve", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                if (ctx.session.selectedPool) {
                    yield (0, index_1.approve)(ctx, undefined, removePoolApprovalSuccessMenu, true, ctx.session.selectedPool.pairAddress, ctx.session.removePoolData.balance.mul(ethers_1.ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100));
                }
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Removing Pool: `, error);
            }
        })).row();
    }
    else {
        range.text("Remove", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (ctx.session.pendingTx) {
                    console.log("[INFO] Transaction pending...");
                    return;
                }
                yield (0, index_1.removePool)(ctx, removePoolSuccessMenu, ctx.session.selectedPool, ctx.session.removePoolData);
            }
            catch (error) {
                ctx.session.pendingTx = false;
                console.error(`[ERROR] Removing Pool: `, error);
            }
        })).row();
    }
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (ctx.session.selectedPool) {
                yield ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error);
        }
    }));
    return range;
}));
const changePercentageRemovePoolMenu = new menu_1.Menu("change-percentage-remove-pool-menu")
    .dynamic(() => {
    const range = new menu_1.MenuRange();
    range.text("Back", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            ctx.session.waitingForRemovePoolAmount = false;
            if (ctx.session.selectedPool) {
                yield ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu });
            }
            else {
                yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error);
        }
    }));
    return range;
});
signInMenu.register(mainMenu);
signInMenu.register(wcMenu);
mainMenu.register(swapMenu);
mainMenu.register(aiMenu);
mainMenu.register(poolsMenu);
mainMenu.register(errorMenu);
swapMenu.register(changeSwapAmountMenu);
swapMenu.register(changeSlippageAmountMenu);
swapMenu.register(confirmSwapMenu);
swapMenu.register(swapTransactionSubmittedMenu);
poolsMenu.register(createPoolMenu);
poolsMenu.register(positionPoolMenu);
positionPoolMenu.register(addToPoolMenu);
positionPoolMenu.register(removePoolMenu);
addToPoolMenu.register(changePooledAddAmountMenu);
addToPoolMenu.register(addToPoolApproveSuccessMenu);
addToPoolMenu.register(addToPoolSuccessMenu);
removePoolMenu.register(removePoolApprovalSuccessMenu);
removePoolMenu.register(removePoolSuccessMenu);
removePoolMenu.register(changePercentageRemovePoolMenu);
createPoolMenu.register(changePooledAmountMenu);
createPoolMenu.register(createPoolSuccessMenu);
// Create bot instance and initialize session middleware
const bot = new grammy_1.Bot(process.env.BOT_TOKEN);
bot.use((0, grammy_1.session)({ initial: () => ({
        wcUri: "",
        wcConnected: false,
        wcProvider: null,
        address: undefined,
        pendingTx: false,
        swapData: {
            fromToken: index_1.ETH_DATA,
            toToken: {
                name: "Versadex",
                symbol: "VDX",
                address: index_1.VERSADEX_CONTRACTS.token,
                decimals: 18
            },
            fromAmount: "0",
            slippage: 5, // 0.5% | amount * 5 / 1000
            pairAddress: index_1.VERSADEX_CONTRACTS.pair,
        },
        createPoolData: {
            token0: index_1.ETH_DATA,
            token1: {
                name: "Versadex",
                symbol: "VDX",
                address: index_1.VERSADEX_CONTRACTS.token,
                decimals: 18
            },
            amount0Desired: "0",
            amount1Desired: "0",
            pairAddress: index_1.VERSADEX_CONTRACTS.pair,
            slippage: 10 // 1% | amount * 10 / 1000
        },
        addToPoolData: {
            token0: null,
            token1: null,
            amount0Desired: "0",
            amount1Desired: "0",
            pairAddress: index_1.NULL_ADDRESS,
            slippage: 10 // 1% | amount * 10 / 1000
        },
        removePoolData: {
            percentage: 50
        },
        waitingForSwapAmount: false,
        waitingForSwapSlippage: false,
        waitingForSwapConfirmation: false,
        waitingForAIPrompt: false,
        waitingForPoolAmount0: false,
        waitingForPoolAmount1: false,
        waitingForAddPoolAmount0: false,
        waitingForAddPoolAmount1: false,
        waitingForRemovePoolAmount: false,
        loadingLiquidityPools: false,
        pools: [],
        selectedPool: index_1.NULL_ADDRESS
    }) } // TODO: Add confirmation page for swap
));
bot.use(signInMenu);
bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.reply(ctx.session.wcConnected ? `💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\`` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? mainMenu : signInMenu, parse_mode: "MarkdownV2" });
}));
bot.on("message:text", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.session.waitingForSwapAmount) {
        try {
            ethers_1.ethers.utils.parseUnits(ctx.message.text, ctx.session.swapData.fromToken.decimals);
            ctx.session.swapData.fromAmount = ctx.message.text;
            ctx.session.waitingForSwapAmount = false;
            yield ctx.reply(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${(0, index_1.formatMD)(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${(0, index_1.formatMD)(yield (0, index_1.getSwapRate)(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: ${error}`);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changeSwapAmountMenu });
        }
    }
    else if (ctx.session.waitingForSwapSlippage) {
        try {
            let slippage = Number(ctx.message.text);
            if (isNaN(slippage)) {
                throw new Error("Slippage must be a number");
            }
            if (slippage < 0 || slippage > 100) {
                throw new Error("Slippage must be between 0 and 100");
            }
            slippage = Number((slippage * 10).toFixed(0));
            console.log(`[INFO] Setting slippage to ${slippage / 10}%...`);
            ctx.session.swapData.slippage = slippage;
            ctx.session.waitingForSwapSlippage = false;
            yield ctx.reply(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${(0, index_1.formatMD)(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${(0, index_1.formatMD)(yield (0, index_1.getSwapRate)(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2" });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: ${error}`);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [0-100 range and a maximum of one decimal separated by a dot]`, { reply_markup: changeSlippageAmountMenu });
        }
    }
    else if (ctx.session.waitingForAIPrompt) {
        try {
            console.log(`[INFO] Processing request: ${ctx.message.text}...`);
            if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
                yield signOut(ctx);
                return;
            }
            if (ctx.message.text.length > 200) {
                console.error(`[ERROR] Message too long: ${ctx.message.text}`);
                yield ctx.reply("🤖 Welcome to VersaAI! 🤖\n\nMaximum 200 characters.", { reply_markup: aiMenu });
                return;
            }
            const processing_msg = yield ctx.reply("Processing your request...");
            const params = yield (0, index_1.processRequest)(ctx.message.text);
            if (!params) {
                throw new Error("Error processing request");
            }
            if (params[0] === "swapExactETHForTokens") {
                ctx.session.swapData.fromToken = index_1.ETH_DATA;
                ctx.session.swapData.fromAmount = params[1];
                ctx.session.swapData.slippage = Number(params[2]) === 0 ? 5 : Number(params[2]);
                if (params[4] === "VDX") {
                    ctx.session.swapData.toToken = {
                        name: "Versadex",
                        symbol: "VDX",
                        address: index_1.VERSADEX_CONTRACTS.token,
                        decimals: 18
                    };
                }
                else {
                    // TODO: Now only supports VDX
                    if (params[3].toLowerCase() === index_1.VERSADEX_CONTRACTS.token.toLowerCase()) {
                        const data = yield (0, index_1.getERC20Data)(ctx, params[3]);
                        ctx.session.swapData.toToken = {
                            name: data.name,
                            symbol: data.symbol,
                            address: data.address,
                            decimals: data.decimals
                        };
                    }
                    else {
                        console.error(`[ERROR] Processing request: Only VDX supported for now.`);
                        yield ctx.api.editMessageText(processing_msg.chat.id, processing_msg.message_id, "🤖 Welcome to VersaAI! 🤖\n\nOnly VDX is supported for now.", { reply_markup: aiMenu });
                        return;
                    }
                }
                ctx.session.waitingForAIPrompt = false;
                yield (0, index_1.swap)(ctx, confirmSwapMenu, swapTransactionSubmittedMenu, true, processing_msg.message_id, true);
            }
            else if (params[0] === "swapExactTokensForETH") {
                ctx.session.swapData.toToken = index_1.ETH_DATA;
                ctx.session.swapData.fromAmount = params[1];
                ctx.session.swapData.slippage = Number(params[2]) === 0 ? 5 : Number(params[2]);
                if (params[4] === "VDX") {
                    ctx.session.swapData.fromToken = {
                        name: "Versadex",
                        symbol: "VDX",
                        address: index_1.VERSADEX_CONTRACTS.token,
                        decimals: 18
                    };
                }
                else {
                    // TODO: Now only supports VDX
                    if (params[3].toLowerCase() === index_1.VERSADEX_CONTRACTS.token.toLowerCase()) {
                        const data = yield (0, index_1.getERC20Data)(ctx, params[3]);
                        ctx.session.swapData.fromToken = {
                            name: data.name,
                            symbol: data.symbol,
                            address: data.address,
                            decimals: data.decimals
                        };
                    }
                    else {
                        console.error(`[ERROR] Processing request: Only VDX supported for now.`);
                        yield ctx.api.editMessageText(processing_msg.chat.id, processing_msg.message_id, "🤖 Welcome to VersaAI! 🤖\n\nOnly VDX is supported for now.", { reply_markup: aiMenu });
                        return;
                    }
                }
                ctx.session.waitingForAIPrompt = false;
                yield (0, index_1.swap)(ctx, confirmSwapMenu, swapTransactionSubmittedMenu, true, processing_msg.message_id, true);
            }
        }
        catch (error) {
            console.error(`[ERROR] Processing request: `, error);
            ctx.session.waitingForAIPrompt = true;
            yield ctx.reply("🤖 Welcome to VersaAI! 🤖\n\nError processing your request.", { reply_markup: aiMenu });
        }
    }
    else if (ctx.session.waitingForPoolAmount0) {
        try {
            ethers_1.ethers.utils.parseUnits(ctx.message.text, ctx.session.createPoolData.token0.decimals);
            ctx.session.createPoolData.amount0Desired = ctx.message.text;
            if (ctx.session.createPoolData.pairAddress !== index_1.NULL_ADDRESS) {
                yield (0, index_1.getLiquidityRatio)(ctx, "1");
            }
            ctx.session.waitingForPoolAmount0 = false;
            yield ctx.reply(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: `, error);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAmountMenu });
        }
    }
    else if (ctx.session.waitingForPoolAmount1) {
        try {
            ethers_1.ethers.utils.parseUnits(ctx.message.text, ctx.session.createPoolData.token1.decimals);
            ctx.session.createPoolData.amount1Desired = ctx.message.text;
            if (ctx.session.createPoolData.pairAddress !== index_1.NULL_ADDRESS) {
                yield (0, index_1.getLiquidityRatio)(ctx, "0");
            }
            ctx.session.waitingForPoolAmount1 = false;
            yield ctx.reply(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: `, error);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAmountMenu });
        }
    }
    else if (ctx.session.waitingForAddPoolAmount0) {
        try {
            ethers_1.ethers.utils.parseUnits(ctx.message.text, ctx.session.addToPoolData.token0.decimals);
            ctx.session.addToPoolData.amount0Desired = ctx.message.text;
            if (ctx.session.addToPoolData.pairAddress !== index_1.NULL_ADDRESS) {
                yield (0, index_1.getLiquidityRatio)(ctx, "1", false);
            }
            ctx.session.waitingForAddPoolAmount0 = false;
            yield ctx.reply(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: `, error);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAddAmountMenu });
        }
    }
    else if (ctx.session.waitingForAddPoolAmount1) {
        try {
            ethers_1.ethers.utils.parseUnits(ctx.message.text, ctx.session.addToPoolData.token1.decimals);
            ctx.session.addToPoolData.amount1Desired = ctx.message.text;
            if (ctx.session.addToPoolData.pairAddress !== index_1.NULL_ADDRESS) {
                yield (0, index_1.getLiquidityRatio)(ctx, "0", false);
            }
            ctx.session.waitingForAddPoolAmount1 = false;
            yield ctx.reply(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${(0, index_1.roundToFirstNonZeroDecimal)(yield (0, index_1.getBalance)(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu });
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: `, error);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAddAmountMenu });
        }
    }
    else if (ctx.session.waitingForRemovePoolAmount) {
        try {
            let percentage = Number(ctx.message.text);
            if (isNaN(percentage)) {
                throw new Error("Percentage must be a number");
            }
            if (percentage < 0 || percentage > 100) {
                throw new Error("Percentage must be between 0 and 100");
            }
            // Round it
            percentage = Math.round(percentage);
            if (ctx.session.selectedPool) {
                ctx.session.removePoolData.percentage = percentage;
                ctx.session.removePoolData.amount0Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(percentage).div(100)));
                ctx.session.removePoolData.amount1Desired = Number(ethers_1.ethers.utils.formatEther(ethers_1.ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(percentage).div(100)));
            }
            ctx.session.waitingForRemovePoolAmount = false;
            if (ctx.session.selectedPool) {
                yield ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${(0, index_1.roundToFirstNonZeroDecimal)(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu });
            }
            else {
                yield ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
            }
        }
        catch (error) {
            console.error(`[ERROR] Parsing amount: `, error);
            yield ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [0 - 100]`, { reply_markup: changePercentageRemovePoolMenu });
        }
    }
}));
function aiChatMenu(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const aiEnabled = true;
        if (aiEnabled) {
            ctx.session.waitingForAIPrompt = true;
            yield ctx.editMessageText("🤖 Welcome to VersaAI! 🤖\n\nPlease enter a message explaining the transaction that you want to perform.", { reply_markup: aiMenu });
        }
        else {
            yield ctx.editMessageText("🤖 Welcome to VersaAI! 🤖\n\nAI is currently disabled. Try again later.", { reply_markup: aiMenu });
        }
    });
}
function swapTokensMenu(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ctx.editMessageText(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${yield (0, index_1.getBalance)(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${(0, index_1.formatMD)(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${(0, index_1.formatMD)(yield (0, index_1.getSwapRate)(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2" });
    });
}
function liquidityPoolsMenu(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (ctx.session.loadingLiquidityPools) {
                yield ctx.editMessageText("Loading liquidity pools...", { reply_markup: undefined });
                const interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    if (!ctx.session.loadingLiquidityPools) {
                        clearInterval(interval);
                        if (ctx.session.pools.length === 0) {
                            yield ctx.editMessageText("No liquidity pools available. Create your first one with the button below!", { reply_markup: poolsMenu });
                        }
                        else {
                            yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
                        }
                    }
                }), 200);
            }
            else {
                if (ctx.session.pools.length === 0) {
                    yield ctx.editMessageText("No liquidity pools available. Create your first one with the button below!", { reply_markup: poolsMenu });
                }
                else {
                    yield ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu });
                }
            }
        }
        catch (error) {
            console.error(`[ERROR] Liquidity Pools Menu: `, error);
            yield ctx.editMessageText("Error loading liquidity pools...", { reply_markup: errorMenu });
        }
    });
}
function connectWallet(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        ctx.session.wcProvider = yield ethereum_provider_1.EthereumProvider.init({
            projectId: process.env.WC_PROJECT_ID,
            chains: [11155111],
            showQrModal: false,
            storageOptions: {
                database: "walletconnect", // Name of the database
                table: "sessions", // Name of the table within the database (optional)
            },
            metadata: {
                name: 'Versadex',
                description: 'DeFi in your own way',
                url: 'https://versadex.finance/',
                icons: ['']
            }
        });
        ctx.session.wcProvider.on("display_uri", (uri) => __awaiter(this, void 0, void 0, function* () {
            ctx.session.wcUri = uri;
            console.log(`[INFO] WalletConnect URI: ${uri}`);
            yield ctx.editMessageText("Connect your wallet", { reply_markup: wcMenu });
        }));
        ctx.session.wcProvider.on("accountsChanged", (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("[INFO] Changing wallet...");
                if (data.length > 0) {
                    try {
                        ctx.session.address = data[0];
                        ctx.session.wcConnected = true;
                        console.log(`[INFO] Wallet changed to ${ctx.session.address}`);
                    }
                    catch (error) {
                        console.error(`[ERROR] Changing wallet: ${error}`);
                    }
                }
                else {
                    yield signOut(ctx);
                    return;
                }
            }
            catch (error) {
                console.error(`[ERROR] Changing wallet: `, error);
                ctx.editMessageText("Welcome to VersaBot!", { reply_markup: signInMenu });
            }
        }));
        ctx.session.wcProvider.connect()
            .then(() => __awaiter(this, void 0, void 0, function* () {
            ctx.session.wcConnected = true;
            console.log("[INFO] Connecting wallet...");
            const pairings = ctx.session.wcProvider.signer.client.pairing.getAll({ active: true });
            console.log(`[INFO] Active pairings: `, pairings);
            (0, index_1.getLiquidityPools)(ctx);
            yield ctx.editMessageText(`💰 \\- ${yield (0, index_1.getBalance)(ctx, index_1.ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" });
        }))
            .catch((error) => {
            console.error("[ERROR] Connecting with WalletConnect:", error);
            ctx.editMessageText("Welcome to VersaBot!", { reply_markup: signInMenu });
        });
    });
}
function signOut(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (ctx.session.address && ctx.session.wcProvider) {
                console.log(`[INFO] Signing out from ${ctx.session.address}...`);
                yield ctx.session.wcProvider.disconnect();
            }
            ctx.editMessageText("Welcome to VersaBot!", { reply_markup: signInMenu });
        }
        catch (error) {
            console.error(`[ERROR] Signing out: `, error);
        }
        finally {
            ctx.session.wcProvider = null;
            ctx.session.wcConnected = false;
            ctx.session.wcUri = undefined;
            ctx.session.address = undefined;
        }
        // try {
        //   await ctx.editMessageText("Welcome to VersaBot!", {reply_markup: signInMenu})
        // } catch (error) {
        //   console.error(`[ERROR] Signing out: `, error)
        // }
    });
}
console.log("[START] Starting the bot...");
bot.start();
// Catch error and restart the bot
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof grammy_1.GrammyError) {
        console.error("Error in request:", e.description);
    }
    else if (e instanceof grammy_1.HttpError) {
        console.error("Could not contact Telegram:", e);
    }
    else {
        console.error("Unknown error:", e);
    }
});
