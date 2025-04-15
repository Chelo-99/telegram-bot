// src/sessionData.ts
import { SessionData } from '../interfaces';
import { ETH_DATA, VERSADEX_CONTRACTS, NULL_ADDRESS } from './constants';

export const initialSessionData = () => ({
    wcUri: "",
    wcConnected: false,
    wcProvider: null,
    address: undefined,
    pendingTx: false,
    swapData: {
        fromToken: ETH_DATA,
        toToken: {
            name: "Versadex",
            symbol: "VDX",
            address: VERSADEX_CONTRACTS.token,
            decimals: 18,
        },
        fromAmount: "0",
        slippage: 5,
        pairAddress: VERSADEX_CONTRACTS.pair,
    },
    createPoolData: {
        token0: ETH_DATA,
        token1: {
            name: "Versadex",
            symbol: "VDX",
            address: VERSADEX_CONTRACTS.token,
            decimals: 18,
        },
        amount0Desired: "0",
        amount1Desired: "0",
        pairAddress: VERSADEX_CONTRACTS.pair,
        slippage: 10,
    },
    addToPoolData: {
        token0: null,
        token1: null,
        amount0Desired: "0",
        amount1Desired: "0",
        pairAddress: NULL_ADDRESS,
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
    selectedPool: NULL_ADDRESS,
} as any);
