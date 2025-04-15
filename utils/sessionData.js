"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialSessionData = void 0;
const constants_1 = require("./constants");
const initialSessionData = () => ({
    wcUri: "",
    wcConnected: false,
    wcProvider: null,
    address: undefined,
    pendingTx: false,
    swapData: {
        fromToken: constants_1.ETH_DATA,
        toToken: {
            name: "Versadex",
            symbol: "VDX",
            address: constants_1.VERSADEX_CONTRACTS.token,
            decimals: 18,
        },
        fromAmount: "0",
        slippage: 5,
        pairAddress: constants_1.VERSADEX_CONTRACTS.pair,
    },
    createPoolData: {
        token0: constants_1.ETH_DATA,
        token1: {
            name: "Versadex",
            symbol: "VDX",
            address: constants_1.VERSADEX_CONTRACTS.token,
            decimals: 18,
        },
        amount0Desired: "0",
        amount1Desired: "0",
        pairAddress: constants_1.VERSADEX_CONTRACTS.pair,
        slippage: 10,
    },
    addToPoolData: {
        token0: null,
        token1: null,
        amount0Desired: "0",
        amount1Desired: "0",
        pairAddress: constants_1.NULL_ADDRESS,
        slippage: 10,
    },
    removePoolData: {
        percentage: 50,
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
    selectedPool: constants_1.NULL_ADDRESS,
});
exports.initialSessionData = initialSessionData;
