// deno-lint-ignore-file no-explicit-any
import { Context, SessionFlavor } from "grammy"

import { BigNumber, ethers } from "ethers";

import ERC20_ABI from "../abis/ERC20";
import ROUTERV2_ABI from "../abis/RouterV2";
import FACTORY_ABI from "../abis/Factory";
import PAIR_ABI from "../abis/Pair";
import { VERSADEX_CONTRACTS, ETH_DATA } from "./constants";

import { SessionData, tokenData } from "../interfaces/index";
import { PoolData, LiquidityPool } from "../interfaces/index";
import { roundToFirstNonZeroDecimal } from "./index";

type MainContext = Context & SessionFlavor<SessionData>;

async function getAllowance(ctx: MainContext, tokenAddress : string | undefined = undefined) : Promise<ethers.BigNumber | null> {
  try {
    if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
      return null
    }

    if (tokenAddress === undefined) {
      tokenAddress = ctx.session.swapData.fromToken.address
    }

    if (tokenAddress === ETH_DATA.address) {
      return null
    }

    console.log(`[INFO] Getting allowance of ${tokenAddress} for ${ctx.session.address}...`)

    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)
    const address = ctx.session.address

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const allowanceInWei = await contract.allowance(address!, VERSADEX_CONTRACTS.routerV2)

    console.log(`[LOG] Allowance: ${allowanceInWei.toString()}`)

    return allowanceInWei
  } catch (error) {
    console.error(`[ERROR] Getting allowance: ${error}`)
    return ethers.BigNumber.from("0")
  }
}

async function getSwapRate(ctx: MainContext, inWei = false) {
  try {
    console.log(`[INFO] Getting swap rate for ${ctx.session.swapData.fromToken.symbol}/${ctx.session.swapData.toToken.symbol}...`)

    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

    let reservesIn = undefined
    let reservesOut = undefined

    const pairContract = new ethers.Contract(ctx.session.swapData.pairAddress, PAIR_ABI, provider)
    const reserves = await pairContract.getReserves()

    if (ctx.session.swapData.fromToken.address < ctx.session.swapData.toToken.address) {
      // Token0 is fromToken
      reservesIn = reserves._reserve0, ctx.session.swapData.fromToken.decimals.toString()
      reservesOut = reserves._reserve1, ctx.session.swapData.toToken.decimals.toString()
    } else {
      // Token1 is fromToken
      reservesIn = reserves._reserve1, ctx.session.swapData.fromToken.decimals.toString()
      reservesOut = reserves._reserve0, ctx.session.swapData.toToken.decimals.toString()
    }

    const routerContract = new ethers.Contract(VERSADEX_CONTRACTS.routerV2, ROUTERV2_ABI, provider)

    let rate = undefined

    if (ctx.session.swapData.fromAmount === "0") {
      rate = "0"
    } else {
      rate = await routerContract.getAmountOut(ethers.utils.parseUnits(ctx.session.swapData.fromAmount, ctx.session.swapData.fromToken.decimals), reservesIn, reservesOut)
    }

    console.log(`[LOG] Rate for exchanging ${ctx.session.swapData.fromAmount} ${ctx.session.swapData.fromToken.symbol}: ${ethers.utils.formatUnits(rate, ctx.session.swapData.toToken.decimals)} ${ctx.session.swapData.toToken.symbol}`)

    return inWei ? rate : ethers.utils.formatUnits(rate, ctx.session.swapData.toToken.decimals)
  } catch (error) {
    console.error(`[ERROR] Getting swap rate: `, error)
    return "0"
  }
}

async function getERC20Data(ctx: MainContext, address: string): Promise<tokenData> {
  if (address.toLowerCase() === ETH_DATA.address.toLowerCase()) {
    return ETH_DATA
  } else {
    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

    const contract = new ethers.Contract(address, ERC20_ABI, provider)

    const name = await contract.name()
    const symbol = await contract.symbol()
    const decimals = await contract.decimals()

    return {
      name: name,
      symbol: symbol,
      address: address,
      decimals: decimals
    }
  }
}

async function approve(ctx: MainContext, confirmMenu: any = undefined, transactionSubmittedMenu: any = undefined, changeMenu = true, tokenInfo: any = undefined, tokenAmount: BigNumber | undefined = undefined) : Promise<string> {
  const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

  const address = typeof tokenInfo === "string" ? tokenInfo : tokenInfo !== undefined ? tokenInfo.address : ctx.session.swapData.fromToken.address
    
  const contract = new ethers.Contract(address, ERC20_ABI, provider)

  const amount = typeof tokenInfo === "string" ? ethers.utils.parseEther(roundToFirstNonZeroDecimal(Number(ethers.utils.formatEther(tokenAmount!)) + 0.01) as string) : tokenInfo !== undefined ? ethers.utils.parseUnits(roundToFirstNonZeroDecimal(Number(ethers.utils.formatUnits(tokenAmount!, tokenInfo.decimals)) + 0.01) as string, tokenInfo.decimals) : ethers.utils.parseUnits(roundToFirstNonZeroDecimal(Number(ctx.session.swapData.fromAmount) + 0.01) as string, ctx.session.swapData.fromToken.decimals)

  console.log(`[INFO] Approving ${amount.toString()}`)

  const tx = {
    from: ctx.session.address,
    to: address,
    data: contract.interface.encodeFunctionData("approve", [VERSADEX_CONTRACTS.routerV2, amount]),
  }

  // Decode data

  console.log(`[INFO] Decoded data for approve: `, contract.interface.decodeFunctionData("approve", tx.data))

  ctx.session.pendingTx = true

  console.log(`[INFO] Transaction: ${JSON.stringify(tx)}`)
  console.log(`[INFO] Sending transaction...`)

  if (changeMenu) {
    ctx.editMessageText(`Sending transaction...\n\nPlease open your wallet to confirm the approve.`, { reply_markup: confirmMenu })
  }

  const result = await provider.send("eth_sendTransaction", [tx])

  // const result = await ctx.session.wcProvider.request({ method: 'eth_sendTransaction', params: [tx] })

  ctx.session.pendingTx = false

  if (changeMenu) {
    ctx.editMessageText(`Approving...`, { reply_markup: confirmMenu })
    await provider.waitForTransaction(result)
    await ctx.editMessageText(`✅ Transaction submitted\\!\n\n🌎 View on [Etherscan](https://sepolia.etherscan.io/tx/${result})`, { reply_markup: transactionSubmittedMenu, parse_mode: "MarkdownV2"})
  }

  console.log(`[LOG] Transaction result: ${result}`)

  return result
}

async function createPool(ctx: MainContext, transactionSubmittedMenu: any, poolData: PoolData) {
  const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

  const signer = provider.getSigner()

  const routerContract = new ethers.Contract(VERSADEX_CONTRACTS.routerV2, ROUTERV2_ABI, signer)

  // Deadline is 10 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 600

  const to = ctx.session.address

  let tx = {}

  if (poolData.token0.address === ETH_DATA.address && poolData.token1.address !== ETH_DATA.address) {
    // Liquidity pool for ETH/token
    const token = poolData.token1.address

    const amountTokenDesired = ethers.utils.parseUnits(poolData.amount1Desired, poolData.token1.decimals)
    const amountTokenMin = amountTokenDesired.sub(amountTokenDesired.mul(poolData.slippage).div(1000))

    const amountETH = ethers.utils.parseUnits(poolData.amount0Desired, poolData.token0.decimals)
    const amountETHMin = amountETH.sub(amountETH.mul(poolData.slippage).div(1000))

    const estimatedGas = await routerContract.estimateGas.addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline, { value: amountETH })

    console.log(`[INFO] Estimated gas: ${estimatedGas.toString()} | Amount ETH: ${amountETH.toString()} | Amount Token Desired: ${amountTokenDesired.toString()} | Amount Token Min: ${amountTokenMin.toString()} | Amount ETH Min: ${amountETHMin.toString()} | To: ${to} | Deadline: ${deadline.toString()}`)

    tx = {
      from: ctx.session.address,
      to: VERSADEX_CONTRACTS.routerV2,
      data: routerContract.interface.encodeFunctionData("addLiquidityETH", [token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline]),
      value: amountETH.toHexString(),
      gas: estimatedGas.toHexString()
    }

  } else if (poolData.token0.address !== ETH_DATA.address && poolData.token1.address === ETH_DATA.address) {
    // Liquidity pool for token/ETH
    const token = poolData.token0.address

    const amountTokenDesired = ethers.utils.parseUnits(poolData.amount0Desired, poolData.token0.decimals)
    const amountTokenMin = amountTokenDesired.sub(amountTokenDesired.mul(poolData.slippage).div(1000))

    const amountETH = ethers.utils.parseUnits(poolData.amount1Desired, poolData.token1.decimals)
    const amountETHMin = amountETH.sub(amountETH.mul(poolData.slippage).div(1000))
    
    const estimatedGas = await routerContract.estimateGas.addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline, { value: amountETH })

    console.log(`[INFO] Estimated gas: ${estimatedGas.toString()} | Amount ETH: ${amountETH.toString()} | Amount Token Desired: ${amountTokenDesired.toString()} | Amount Token Min: ${amountTokenMin.toString()} | Amount ETH Min: ${amountETHMin.toString()} | To: ${to} | Deadline: ${deadline.toString()}`)

    tx = {
      from: ctx.session.address,
      to: VERSADEX_CONTRACTS.routerV2,
      data: routerContract.interface.encodeFunctionData("addLiquidityETH", [token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline]),
      value: amountETH.toHexString(),
      gas: estimatedGas.toHexString()
    }
  } else {
    // Liquidity pool for token/token

    // Not implemented yet
  }

  ctx.session.pendingTx = true

  console.log(`[INFO] Transaction: ${JSON.stringify(tx)}`)
  console.log(`[INFO] Sending transaction...`)

  ctx.editMessageText(`Sending transaction...\n\nPlease open your wallet to confirm the swap.`, { reply_markup: undefined })

  const result = await ctx.session.wcProvider.request({ method: 'eth_sendTransaction', params: [tx] })

  // Wait for transaction to be mined

  await provider.waitForTransaction(result)

  // Change pool info for the user

  // Find inside the pools array the address of the pool that was just created, if there is not then push it to the array

  const pool = await getLiquidityPool(ctx, poolData.pairAddress) // Updated info

  if (pool !== null) {
    const poolIndex = ctx.session.pools.findIndex((p) => p.pairAddress === pool.pairAddress)

    if (poolIndex === -1) {
      ctx.session.pools.push(pool)
    } else {
      ctx.session.pools[poolIndex] = pool
    }
  }

  ctx.session.pendingTx = false

  console.log(`[LOG] Transaction result: ${result}`)
  
  await ctx.editMessageText(`✅ Transaction submitted\\!\n\n🌎 View on [Etherscan](https://sepolia.etherscan.io/tx/${result})`, { reply_markup: transactionSubmittedMenu, parse_mode: "MarkdownV2"})
}

async function removePool(ctx: MainContext, submittedMenu: any, selectedPool: LiquidityPool & {
  token0Reserve: number
  token1Reserve: number
  totalSupply: BigNumber
  percentageOfOwnership: number
} | null, removePoolData: {
  balance: BigNumber
  percentage: number
  amount0Desired: number
  amount1Desired: number
}) {
  const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

  const signer = provider.getSigner()

  const routerContract = new ethers.Contract(VERSADEX_CONTRACTS.routerV2, ROUTERV2_ABI, signer)

  // Deadline is 10 minutes from now

  const deadline = Math.floor(Date.now() / 1000) + 600

  const to = ctx.session.address

  let token = undefined
  let amountTokenMin = undefined
  let amountETHMin = undefined

  if (selectedPool && selectedPool.token0.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
    // Token0 is not ETH

    token = selectedPool.token0.address
    const reToken = new RegExp('^-?\\d+(?:\.\\d{0,' + (selectedPool.token0.decimals || -1) + '})?');
    const amountToken = String(removePoolData.amount0Desired - (removePoolData.amount0Desired * 10 / 100))
    amountTokenMin = ethers.utils.parseUnits(amountToken.match(reToken)![0], selectedPool.token0.decimals)
    const reETH = new RegExp('^-?\\d+(?:\.\\d{0,' + (selectedPool.token1.decimals || -1) + '})?');
    const amountETH = String(removePoolData.amount1Desired - (removePoolData.amount1Desired * 10 / 100))
    amountETHMin = ethers.utils.parseUnits(amountETH.match(reETH)![0], selectedPool.token1.decimals)
  } else if (selectedPool && selectedPool.token1.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
    // Token1 is not ETH

    token = selectedPool.token1.address
    const reToken = new RegExp('^-?\\d+(?:\.\\d{0,' + (selectedPool.token1.decimals || -1) + '})?');
    const amountToken = String(removePoolData.amount1Desired - (removePoolData.amount1Desired * 10 / 100))
    amountTokenMin = ethers.utils.parseUnits(amountToken.match(reToken)![0], selectedPool.token1.decimals)
    const reETH = new RegExp('^-?\\d+(?:\.\\d{0,' + (selectedPool.token0.decimals || -1) + '})?');
    const amountETH = String(removePoolData.amount0Desired - (removePoolData.amount0Desired * 10 / 100))
    amountETHMin = ethers.utils.parseUnits(amountETH.match(reETH)![0], selectedPool.token0.decimals)
  }

  const amountOfLP = removePoolData.balance.mul(ethers.BigNumber.from(removePoolData.percentage)).div(100)

  const estimatedGas = await routerContract.estimateGas.removeLiquidityETH(token, amountOfLP, amountTokenMin, amountETHMin, to, deadline)

    console.log(`[INFO] Estimated gas: ${estimatedGas.toString()} | Amount ETH Min: ${amountETHMin?.toString()} | Amount Token Min: ${amountTokenMin?.toString()} | Amount LP Tokens: ${amountOfLP.toString()} | To: ${to} | Deadline: ${deadline.toString()}`)

  const tx = {
    from: ctx.session.address,
    to: VERSADEX_CONTRACTS.routerV2,
    data: routerContract.interface.encodeFunctionData("removeLiquidityETH", [token, amountOfLP, amountTokenMin, amountETHMin, to, deadline]),
    gas: estimatedGas.toHexString()
  }

  ctx.session.pendingTx = true

  console.log(`[INFO] Transaction: ${JSON.stringify(tx)}`)
  console.log(`[INFO] Sending transaction...`)

  ctx.editMessageText(`Sending transaction...\n\nPlease open your wallet to confirm the swap.`, { reply_markup: undefined })

  const result = await ctx.session.wcProvider.request({ method: 'eth_sendTransaction', params: [tx] })

  // Wait for transaction to be mined

  await provider.waitForTransaction(result)

  // Change pool info for the user

  // Find inside the pools array the address of the pool that was just created, if there is not then push it to the array

  if (selectedPool) {
    const pool = await getLiquidityPool(ctx, selectedPool.pairAddress) // Updated info

    if (pool !== null) {
      const poolIndex = ctx.session.pools.findIndex((p:any) => p.pairAddress === pool.pairAddress)
  
      if (poolIndex === -1) {
        ctx.session.pools.push(pool)
      } else {
        ctx.session.pools[poolIndex] = pool
      }
    } else {
      // Remove that pool from the array
      const poolIndex = ctx.session.pools.findIndex((p:any) => p.pairAddress === selectedPool.pairAddress)
      if (poolIndex !== -1) {
        ctx.session.pools.splice(poolIndex, 1)
      }
    }
  }


  ctx.session.pendingTx = false

  console.log(`[LOG] Transaction result: ${result}`)
  
  await ctx.editMessageText(`✅ Transaction submitted\\!\n\n🌎 View on [Etherscan](https://sepolia.etherscan.io/tx/${result})`, { reply_markup: submittedMenu, parse_mode: "MarkdownV2"})
}

async function swap(ctx: MainContext, confirmSwapMenu: any, swapTransactionSubmittedMenu: any, editMessage = false, editMessageId = -1, fromAI = false) {
  const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

  const signer = provider.getSigner()

  const routerContract = new ethers.Contract(VERSADEX_CONTRACTS.routerV2, ROUTERV2_ABI, signer)

  // Deadline is 10 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 600

  const amountIn = ethers.utils.parseUnits(ctx.session.swapData.fromAmount, ctx.session.swapData.fromToken.decimals)
  const amountOut = await getSwapRate(ctx, true)
  const amountOutMin = amountOut.sub(amountOut.mul(ctx.session.swapData.slippage).div(1000))

  const path = [ctx.session.swapData.fromToken.address, ctx.session.swapData.toToken.address]

  const to = ctx.session.address

  console.log(`[INFO] Amount In: ${amountIn} | Amount Out: ${amountOut} | Amount Out Min: ${amountOutMin} | Deadline: ${deadline} | Path: ${path} | To: ${to}`)

  let tx = {}

  if (ctx.session.swapData.fromToken.address === ETH_DATA.address && ctx.session.swapData.toToken.address !== ETH_DATA.address) {
    // Swap ETH for token
    // Send transaction using eth_sendTransaction with wcProvider, not ethers

    const gasLimit = await routerContract.estimateGas.swapExactETHForTokens(amountOutMin, path, to, deadline, { value: amountIn })

    tx = {
      from: ctx.session.address,
      to: VERSADEX_CONTRACTS.routerV2,
      data: routerContract.interface.encodeFunctionData("swapExactETHForTokens", [amountOutMin, path, to, deadline]),
      value: amountIn.toHexString(),
      gas: gasLimit.toHexString()
    }
  } else if (ctx.session.swapData.fromToken.address !== ETH_DATA.address && ctx.session.swapData.toToken.address === ETH_DATA.address) {
    // If fromAI is set to true, we need to approve the tokens in case the router doesn't have enough allowance

    if (fromAI) {
      const allowance = await getAllowance(ctx)

      if (allowance === null || allowance.lt(amountIn)) {
        console.log(`[INFO] Approving tokens from AI prompt...`)

        ctx.api.editMessageText(ctx.chat!.id, editMessageId, `Sending transaction...\n\nPlease open your wallet to confirm the approve.`, { reply_markup: confirmSwapMenu })

        const approveHash = await approve(ctx, confirmSwapMenu, swapTransactionSubmittedMenu, false)

        ctx.api.editMessageText(ctx.chat!.id, editMessageId, `Approving...`, { reply_markup: confirmSwapMenu })

        await provider.waitForTransaction(approveHash)
      }
    }

    // Swap token for ETH

    const gasLimit = await routerContract.estimateGas.swapExactTokensForETH(amountIn, amountOutMin, path, to, deadline)

    console.log(`[LOG] Gas limit: ${gasLimit}`)

    tx = {
      from: ctx.session.address,
      to: VERSADEX_CONTRACTS.routerV2,
      data: routerContract.interface.encodeFunctionData("swapExactTokensForETH", [amountIn, amountOutMin, path, to, deadline]),
      value: "0x0",
      gas: gasLimit.toHexString()
    }
  } else {
    // Swap token for token
  }

  ctx.session.pendingTx = true

  console.log(`[INFO] Transaction: ${JSON.stringify(tx)}`)
  console.log(`[INFO] Sending transaction...`)

  if (editMessage) {
    ctx.api.editMessageText(ctx.chat!.id, editMessageId, `Sending transaction...\n\nPlease open your wallet to confirm the swap.`, { reply_markup: confirmSwapMenu })
  } else {
    ctx.editMessageText(`Sending transaction...\n\nPlease open your wallet to confirm the swap.`, { reply_markup: confirmSwapMenu })
  }

  const result = await ctx.session.wcProvider.request({ method: 'eth_sendTransaction', params: [tx] })

  ctx.session.pendingTx = false

  await provider.waitForTransaction(result)

  if (editMessage) {
    await ctx.api.editMessageText(ctx.chat!.id, editMessageId, `✅ Transaction submitted\\!\n\n🌎 View on [Etherscan](https://sepolia.etherscan.io/tx/${result})`, { reply_markup: swapTransactionSubmittedMenu, parse_mode: "MarkdownV2"})
  } else {
    await ctx.editMessageText(`✅ Transaction submitted\\!\n\n🌎 View on [Etherscan](https://sepolia.etherscan.io/tx/${result})`, { reply_markup: swapTransactionSubmittedMenu, parse_mode: "MarkdownV2"})
  }

  console.log(`[LOG] Transaction result: ${result}`)
}

async function getBalance(ctx: MainContext, token: tokenData, format = true) {
  try {
    console.log(`[INFO] Getting ${token.symbol} balance for ${ctx.session.address}...`)

    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)
    const address = ctx.session.address
    
    let balance = "0.0"

    if (token.address === ETH_DATA.address) {
      const balanceInWei = await provider.getBalance(address!)
      balance = ethers.utils.formatEther(balanceInWei)
    } else {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider)
      const balanceInWei = await contract.balanceOf(address!)
      balance = ethers.utils.formatUnits(balanceInWei, token.decimals)
    }

    return format ? balance.replace(".", "\\.") : balance
  } catch (error) {
    console.error(`[ERROR] Getting ${token.symbol} balance: `, error)
    return format ? "0\\.0" : "0.0"
  }
}

async function signMessage(ctx: MainContext, mainMenu: any) {
  try {
    if (ctx.session.pendingTx) {
      console.log("[INFO] Transaction pending...")
      return
    }

    console.log(`[INFO] Signing message for ${ctx.session.address}...`)
    // console.log(`[LOG] Provider: ${ctx.session.wcProvider}`)

    const encoder = new TextEncoder();

    const message = "Welcome to VersaBot! Make seamless DeFi transactions!";

    const msgBuffer = encoder.encode(message);

    // Convert to hex string
    const msg = Array.prototype.map.call(msgBuffer, (x: any) => ("00" + x.toString(16)).slice(-2)).join("");

    await ctx.editMessageText(`Signing message...\n\nPlease open your wallet to sign the message.`)

    ctx.session.pendingTx = true
    
    const result = await ctx.session.wcProvider.request({ method: 'personal_sign', params: [`0x${msg}`, ctx.session.address] })

    ctx.session.pendingTx = false

    console.log(`[LOG] Signature: ${result}`)
    const signature = ethers.utils.splitSignature(result)
    console.log(`[LOG] Signature: ${JSON.stringify(signature)}`)

    await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
  } catch (error) {
    console.error(error)
  }
}

async function getLiquidityPool(ctx: MainContext, pair: string) {
  try {
    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

    const address = ctx.session.address

    const pairContract = new ethers.Contract(pair, PAIR_ABI, provider)

    const balance = await pairContract.balanceOf(address)

    if (balance.eq(0)) {
      return null
    }

    const token0 = await pairContract.token0()
    const token1 = await pairContract.token1()

    const token0Data = await getERC20Data(ctx, token0)
    const token1Data = await getERC20Data(ctx, token1)

    return {
      pairAddress: pair,
      token0: token0Data,
      token1: token1Data,
      balance: balance,
    }
  } catch (error) {
    console.error(`[ERROR] Getting liquidity pool: `, error)

    return null
  }
}

async function getLiquidityPools(ctx: MainContext) {
  ctx.session.loadingLiquidityPools = true

  try {
    console.log(`[INFO] Getting liquidity pools...`)

    const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

    const factoryContract = new ethers.Contract(VERSADEX_CONTRACTS.factory, FACTORY_ABI, provider)

    const allPairsLength = await factoryContract.allPairsLength()

    const address = ctx.session.address

    const pairs = []

    console.log(`[INFO] All pairs length: ${allPairsLength}`)

    for (let i = 0; i < allPairsLength; i++) {
      const pairAddress = await factoryContract.allPairs(i)
      console.log(`[LOG] Pair address: ${pairAddress}`)
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider)

      const balance = await pairContract.balanceOf(address)

      if (balance.gt(0)) {
        const token0 = await pairContract.token0()
        const token1 = await pairContract.token1()

        const token0Data = await getERC20Data(ctx, token0)
        const token1Data = await getERC20Data(ctx, token1)

        pairs.push({
          pairAddress: pairAddress,
          token0: token0Data,
          token1: token1Data,
          balance: balance,
        })
      }
    }

    console.log(`[LOG] Pairs of ${address}: ${JSON.stringify(pairs)}`)

    ctx.session.pools = pairs

    ctx.session.loadingLiquidityPools = false
  } catch (error) {
    ctx.session.loadingLiquidityPools = false
    console.error(`[ERROR] Getting liquidity pools: `, error)
  }
}

async function getLiquidityRatio(ctx: MainContext, tokenToCalculate: string, create = true) { // tokenToCalculate is the token that we want to calculate the liquidity ratio for. Can be either 0 or 1
  const pairAddress = ctx.session.createPoolData.pairAddress

  const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

  const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider)

  const reserves = await pairContract.getReserves()

  let reserves0 = null
  let reserves1 = null

  if (create ? ctx.session.createPoolData.token0.address < ctx.session.createPoolData.token1.address : ctx.session.addToPoolData.token0.address < ctx.session.addToPoolData.token1.address) {
    reserves0 = reserves._reserve0
    reserves1 = reserves._reserve1
  } else {
    reserves0 = reserves._reserve1
    reserves1 = reserves._reserve0
  }

  if (tokenToCalculate === "0") {
    if (create) {
      const ratio = Number(ethers.utils.formatUnits(reserves0, ctx.session.createPoolData.token0.decimals)) / Number(ethers.utils.formatUnits(reserves1, ctx.session.createPoolData.token1.decimals))
      const amount = String(Number(ctx.session.createPoolData.amount1Desired) * ratio)
      const re = new RegExp('^-?\\d+(?:\.\\d{0,' + (ctx.session.createPoolData.token0.decimals || -1) + '})?');
      ctx.session.createPoolData.amount0Desired = amount.match(re)![0]
    } else {
      const ratio = Number(ethers.utils.formatUnits(reserves0, ctx.session.addToPoolData.token0.decimals)) / Number(ethers.utils.formatUnits(reserves1, ctx.session.addToPoolData.token1.decimals))
      const amount = String(Number(ctx.session.addToPoolData.amount1Desired) * ratio)
      const re = new RegExp('^-?\\d+(?:\.\\d{0,' + (ctx.session.addToPoolData.token0.decimals || -1) + '})?');
      ctx.session.addToPoolData.amount0Desired = amount.match(re)![0]
    }
  } else if (tokenToCalculate === "1") {
    if (create) {
      const ratio = Number(ethers.utils.formatUnits(reserves1, ctx.session.createPoolData.token1.decimals)) / Number(ethers.utils.formatUnits(reserves0, ctx.session.createPoolData.token0.decimals))
      const amount = String(Number(ctx.session.createPoolData.amount0Desired) * ratio)
      const re = new RegExp('^-?\\d+(?:\.\\d{0,' + (ctx.session.createPoolData.token1.decimals || -1) + '})?');
      ctx.session.createPoolData.amount1Desired = amount.match(re)![0]
    } else {
      const ratio = Number(ethers.utils.formatUnits(reserves1, ctx.session.addToPoolData.token1.decimals)) / Number(ethers.utils.formatUnits(reserves0, ctx.session.addToPoolData.token0.decimals))
      const amount = String(Number(ctx.session.addToPoolData.amount0Desired) * ratio)
      const re = new RegExp('^-?\\d+(?:\.\\d{0,' + (ctx.session.addToPoolData.token1.decimals || -1) + '})?');
      ctx.session.addToPoolData.amount1Desired = amount.match(re)![0]
    }
  }
}

export { getAllowance, getSwapRate, swap, getERC20Data, approve, getBalance, signMessage, getLiquidityPools, getLiquidityPool, getLiquidityRatio, createPool, removePool }