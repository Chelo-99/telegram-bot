import { BigNumber } from "ethers";

interface tokenData {
  name: string
  symbol: string
  address: string
  decimals: number
}

interface swapData {
  fromToken: tokenData
  toToken: tokenData
  fromAmount: string
  slippage: number
  pairAddress: string
}

interface LiquidityPool {
  pairAddress: string
  token0: tokenData
  token1: tokenData
  balance: BigNumber
  // Total supply has to calculated in real time
  // Reserves same thing
}

interface PoolData {
  pairAddress: string
  token0: tokenData
  token1: tokenData
  amount0Desired: string
  amount1Desired: string
  slippage: number
}

interface SessionData {
  wcProvider?: any
  wcUri?: string
  wcConnected: boolean
  address?: string
  pendingTx: boolean
  swapData: swapData
  createPoolData: PoolData
  addToPoolData: PoolData
  removePoolData: {
    balance: BigNumber
    percentage: number
    amount0Desired: number
    amount1Desired: number
  }
  waitingForSwapAmount: boolean
  waitingForSwapSlippage: boolean
  waitingForSwapConfirmation: boolean
  waitingForPoolAmount0: boolean
  waitingForPoolAmount1: boolean
  waitingForAddPoolAmount0: boolean
  waitingForAddPoolAmount1: boolean
  waitingForRemovePoolAmount: boolean
  waitingForAIPrompt: boolean
  loadingLiquidityPools: boolean
  pools: Array<LiquidityPool>
  selectedPool: LiquidityPool & {
    token0Reserve: number
    token1Reserve: number
    totalSupply: BigNumber
    percentageOfOwnership: number
  } | null
}

interface OpenAISwapParams {
  type: "swapExactETHForTokens" | "swapExactTokensForETH";
  amount: string;
  slippage: string;
  tokenAddress: string;
  tokenSymbol: string;
}

export type { tokenData, swapData, SessionData, PoolData, LiquidityPool,OpenAISwapParams }