// deno-lint-ignore-file no-explicit-any
/* eslint no-use-before-define: 0 */

import dotenv from "dotenv"
dotenv.config()

 import { Bot, Context, GrammyError, HttpError, SessionFlavor, session } from "grammy"
// import { Menu, MenuRange } from "https://deno.land/x/grammy_menu@v1.2.1/mod.ts"

// import { EthereumProvider } from "npm:@walletconnect/ethereum-provider@2.9.1"
import { Menu, MenuRange } from "@grammyjs/menu"
import {ethers} from "ethers"
import {EthereumProvider} from "@walletconnect/ethereum-provider"
import { SessionData } from "./interfaces/index"

interface TokenData {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}


import { 
  roundToFirstNonZeroDecimal, 
  getERC20Data, 
  getBalance, 
  approve, 
  swap, 
  getAllowance, 
  getDeepLink, 
  processRequest, 
  formatMD, 
  getSwapRate, 
  getLiquidityPools, 
  getLiquidityRatio,
  createPool,
  removePool,
  ETH_DATA,
  VERSADEX_CONTRACTS, 
  NULL_ADDRESS,
  initialSessionData,
} from "./utils/index";
import PAIR_ABI from "./abis/Pair";

type MainContext = Context & SessionFlavor<SessionData>;



const signInMenu = new Menu<MainContext>("sign-in-menu")
  .text("Connect Wallet", connectWallet)

const mainMenu = new Menu<MainContext>("main-menu")
  .text("Swap Tokens", swapTokensMenu)
  // .text("Liq pool", (ctx) => ctx.reply("liq-pool")).row()
  // .text("Sign message", signMessage).row()
  .text("Liquidity Pools", liquidityPoolsMenu).row()
  .text("VersaAI", aiChatMenu).row()
  .url("Top-Up with FIAT", "https://t.me/versatest_bot/top_up").row()
  .text("Sign Out", signOut)

const aiMenu = new Menu<MainContext>("ai-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();

    range.text("Back", async (ctx) => {
      ctx.session.waitingForAIPrompt = false

      await ctx.editMessageText(ctx.session.wcConnected ? `💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\`` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? mainMenu : signInMenu, parse_mode: "MarkdownV2" })
    });

    return range
  })

const wcMenu = new Menu<MainContext>("wc-menu")
  .dynamic((ctx) => {
    const range = new MenuRange<MainContext>();

    range.url("Metamask", getDeepLink(ctx.session.wcUri!, "metamask") || "https://versadex.finance").row();
    // range.url("Trust", getDeepLink(ctx.session.wcUri!, "trust") || "https://versadex.finance").row();
    range.back("Back");

    return range;
  });

const confirmSwapMenu = new Menu<MainContext>("confirm-swap-menu")

const swapTransactionSubmittedMenu = new Menu<MainContext>("transaction-submitted-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
          await signOut(ctx)
          return
        }
        await swapTokensMenu(ctx)
      } catch (error) {
        console.error(`[ERROR] Back to Swap Menu from Transaction Submitted Menu: `, error)
      }
    });
    return range;
  });



const errorMenu = new Menu<MainContext>("error-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
          await signOut(ctx)
          return
        }
        await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
      } catch (error) {
        console.error(`[ERROR] Back to Main Menu from Error Menu: `, error)
      }
    });
    return range;
  });

const poolsMenu = new Menu<MainContext>("pools-menu")
  .dynamic((ctx) => {
    const range = new MenuRange<MainContext>();
    
    const nOfPools = ctx.session.pools.length

    for (let i = 0; i < nOfPools; i++) {
      const pool = ctx.session.pools[i]

      range.text(`${pool.token0.symbol}/${pool.token1.symbol} - ${roundToFirstNonZeroDecimal(ethers.utils.formatEther(pool.balance))} LP Tokens`, async (ctx) => {
        try {
          // Calculate data here to get the most recent information

          const provider = new ethers.providers.Web3Provider(ctx.session.wcProvider)

          const pairContract = new ethers.Contract(pool.pairAddress, PAIR_ABI, provider)

          const totalSupply = await pairContract.totalSupply()

          const percentageOfOwnership = (Number(ethers.utils.formatEther(pool.balance)) / Number(ethers.utils.formatEther(totalSupply)))

          const reserves = await pairContract.getReserves()

          let token0Reserve = undefined
          let token1Reserve = undefined

          if (pool.token0.address < pool.token1.address) {
            const re0 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token0.decimals || -1) + '})?');
            token0Reserve = Number(String(Number(ethers.utils.formatEther(reserves._reserve0)) * percentageOfOwnership).match(re0)![0])
            const re1 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token1.decimals || -1) + '})?');
            token1Reserve = Number(String(Number(ethers.utils.formatEther(reserves._reserve1)) * percentageOfOwnership).match(re1)![0])
          } else {
            const re0 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token0.decimals || -1) + '})?');
            token0Reserve = Number(String(Number(ethers.utils.formatEther(reserves._reserve1)) * percentageOfOwnership).match(re0)![0])
            const re1 = new RegExp('^-?\\d+(?:\.\\d{0,' + (pool.token1.decimals || -1) + '})?');
            token1Reserve = Number(String(Number(ethers.utils.formatEther(reserves._reserve0)) * percentageOfOwnership).match(re1)![0])
          }

          ctx.session.selectedPool = {
            ...pool,
            token0Reserve,
            token1Reserve,
            totalSupply,
            percentageOfOwnership
          }

          ctx.session.removePoolData.amount0Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(token0Reserve)).mul(50).div(100)))
          ctx.session.removePoolData.amount1Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(token1Reserve)).mul(50).div(100)))
          ctx.session.removePoolData.balance = pool.balance
          ctx.session.removePoolData.percentage = 50

          await ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu })
        } catch (error) {
          console.error(`[ERROR] Selecting pool: `, error)
        }
      
      }).row()
    }

    range.text("Create Pool", async (ctx) => {
      try {
        await ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu })
      } catch (error) {
        console.error(`[ERROR] Create Pool: `, error)
      }
    }).row()

    range.text("Back", async (ctx) => {
      try {
        await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
      } catch (error) {
        console.error(`[ERROR] Back to Main Menu from Swap Menu: ${error}`)
      }
    });

    return range
  });

const createPoolSuccessMenu = new Menu<MainContext>("create-pool-approve-success-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        await ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Create Pool Success Menu: `, error)
      }
    });
    return range;
  });

const addToPoolApproveSuccessMenu = new Menu<MainContext>("add-to-pool-approve-success-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          await ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error)
      }
    });
    return range;
  });

const addToPoolSuccessMenu = new Menu<MainContext>("add-to-pool-success-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        ctx.session.selectedPool = null
        ctx.session.addToPoolData.pairAddress = NULL_ADDRESS
        await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error)
      }
    });
    return range;
  }); 
  
const removePoolSuccessMenu = new Menu<MainContext>("remove-pool-success-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Close", async (ctx) => {
      try {
        ctx.session.selectedPool = null
        ctx.session.removePoolData.amount0Desired = 0
        ctx.session.removePoolData.amount1Desired = 0
        ctx.session.removePoolData.balance = ethers.BigNumber.from(0)
        ctx.session.removePoolData.percentage = 50
        await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Add to Pool Success Menu: `, error)
      }
    });
    return range;
  });  

const positionPoolMenu = new Menu<MainContext>("position-pool-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();

    range.text("Add", async (ctx) => {
      try {
        if (ctx.session.pendingTx) {
          console.log("[INFO] Transaction pending...")
          return
        }

        if (ctx.session.selectedPool) {
          if (ctx.session.addToPoolData.pairAddress === NULL_ADDRESS) {
            ctx.session.addToPoolData = {
              pairAddress: ctx.session.selectedPool.pairAddress,
              token0: ctx.session.selectedPool.token0,
              token1: ctx.session.selectedPool.token1,
              amount0Desired: "0",
              amount1Desired: "0",
              slippage: 10
            }
          }
          await ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Adding to Pool Menu: `, error)
      }
    });
    range.text("Remove", async (ctx) => {
      if (ctx.session.selectedPool) {
        await ctx.editMessageText(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu })
      } else {
        await ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      }
    }).row();

    range.text("Back", async (ctx) => {
      try {
        ctx.session.selectedPool = null
        ctx.session.addToPoolData.pairAddress = NULL_ADDRESS
        await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Create Pool Menu: `, error)
      }
    });

    return range;
  });

const createPoolMenu = new Menu<MainContext>("create-pool-menu")
  .dynamic(async (ctx) => {
    const range = new MenuRange<MainContext>();

    let allowance = undefined

    if (ctx.session.createPoolData.token0.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
      console.log(`[INFO] Checking allowance for ${ctx.session.createPoolData.token0.symbol}...`)
      allowance = await getAllowance(ctx, ctx.session.createPoolData.token0.address) as ethers.BigNumber
      console.log(`[INFO] Allowance for ${ctx.session.createPoolData.token0.symbol}: ${allowance}`)
    } else if (ctx.session.createPoolData.token1.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
      console.log(`[INFO] Checking allowance for ${ctx.session.createPoolData.token1.symbol}...`)
      allowance = await getAllowance(ctx, ctx.session.createPoolData.token1.address) as ethers.BigNumber
      console.log(`[INFO] Allowance for ${ctx.session.createPoolData.token1.symbol}: ${allowance}`)
    }

    range.text(`${ctx.session.createPoolData.token0.symbol}`)
    range.text("/")
    range.text(`${ctx.session.createPoolData.token1.symbol}`).row()
    range.text(`Pooled ${ctx.session.createPoolData.token0.symbol}`, async (ctx) => {
      try {
        ctx.session.waitingForPoolAmount0 = true
        await ctx.editMessageText(`Enter an amount of ${ctx.session.createPoolData.token0.symbol} to pool: `, { reply_markup: changePooledAmountMenu })
      } catch (error) {
        ctx.session.waitingForPoolAmount0 = false
        console.error(`[ERROR] Changing desired Amount0: `, error)
      }
    });
    range.text(`Pooled ${ctx.session.createPoolData.token1.symbol}`, async (ctx) => {
      try {
        ctx.session.waitingForPoolAmount1 = true
        await ctx.editMessageText(`Enter an amount of ${ctx.session.createPoolData.token1.symbol} to pool: `, { reply_markup: changePooledAmountMenu })
      } catch (error) {
        ctx.session.waitingForPoolAmount1 = false
        console.error(`[ERROR] Changing desired Amount1: `, error)
      }
    }).row();

    if (ctx.session.createPoolData.token0.address.toLowerCase() !== ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals))) {
      // Approve token0
      console.log(`[INFO] Amount0Desired: ${ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals)}`)
      range.text("Approve", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          
          await approve(ctx, undefined, createPoolSuccessMenu, true, ctx.session.createPoolData.token0, ethers.utils.parseUnits(ctx.session.createPoolData.amount0Desired, ctx.session.createPoolData.token0.decimals))
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Creating Pool: `, error)
        }
      }).row();
    } else if (ctx.session.createPoolData.token1.address.toLowerCase() !== ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals))) {
      // Approve token1
      console.log(`[INFO] Amount1Desired: ${ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals)}`)
      range.text("Approve", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          
          await approve(ctx, undefined, createPoolSuccessMenu, true, ctx.session.createPoolData.token1, ethers.utils.parseUnits(ctx.session.createPoolData.amount1Desired, ctx.session.createPoolData.token1.decimals))
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Creating Pool: `, error)
        }
      }).row();
    } else {
      range.text("Create Pool", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          // await createPool(ctx)
          await createPool(ctx, createPoolSuccessMenu, ctx.session.createPoolData)
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Creating Pool: `, error)
        }
      }).row();
    }

    range.text("Back", async (ctx) => {
      try {
        await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Create Pool Menu: `, error)
      }
    });
    return range;
  });

  const addToPoolMenu = new Menu<MainContext>("add-to-pool-menu")
  .dynamic(async (ctx) => {
    const range = new MenuRange<MainContext>();

    let allowance = undefined

    if (ctx.session.addToPoolData.token0.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
      console.log(`[INFO] Checking allowance for ${ctx.session.addToPoolData.token0.symbol}...`)
      allowance = await getAllowance(ctx, ctx.session.addToPoolData.token0.address) as ethers.BigNumber
      console.log(`[INFO] Allowance for ${ctx.session.addToPoolData.token0.symbol}: ${allowance}`)
    } else if (ctx.session.addToPoolData.token1.address.toLowerCase() !== ETH_DATA.address.toLowerCase()) {
      console.log(`[INFO] Checking allowance for ${ctx.session.addToPoolData.token1.symbol}...`)
      allowance = await getAllowance(ctx, ctx.session.addToPoolData.token1.address) as ethers.BigNumber
      console.log(`[INFO] Allowance for ${ctx.session.addToPoolData.token1.symbol}: ${allowance}`)
    }

    range.text(`${ctx.session.addToPoolData.token0.symbol}`)
    range.text("/")
    range.text(`${ctx.session.addToPoolData.token1.symbol}`).row()
    range.text(`Pooled ${ctx.session.addToPoolData.token0.symbol}`, async (ctx) => {
      try {
        ctx.session.waitingForAddPoolAmount0 = true
        await ctx.editMessageText(`Enter an amount of ${ctx.session.addToPoolData.token0.symbol} to pool: `, { reply_markup: changePooledAddAmountMenu })
      } catch (error) {
        ctx.session.waitingForAddPoolAmount0 = false
        console.error(`[ERROR] Changing desired Amount0: `, error)
      }
    });
    range.text(`Pooled ${ctx.session.addToPoolData.token1.symbol}`, async (ctx) => {
      try {
        ctx.session.waitingForAddPoolAmount1 = true
        await ctx.editMessageText(`Enter an amount of ${ctx.session.addToPoolData.token1.symbol} to pool: `, { reply_markup: changePooledAddAmountMenu })
      } catch (error) {
        ctx.session.waitingForAddPoolAmount1 = false
        console.error(`[ERROR] Changing desired Amount1: `, error)
      }
    }).row();

    if (ctx.session.addToPoolData.token0.address.toLowerCase() !== ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals))) {
      // Approve token0
      console.log(`[INFO] Amount0Desired: ${ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals)}`)
      range.text("Approve", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          
          await approve(ctx, undefined, addToPoolApproveSuccessMenu, true, ctx.session.addToPoolData.token0, ethers.utils.parseUnits(ctx.session.addToPoolData.amount0Desired, ctx.session.addToPoolData.token0.decimals))
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Adding to Pool: `, error)
        }
      }).row();
    } else if (ctx.session.addToPoolData.token1.address.toLowerCase() !== ETH_DATA.address.toLowerCase() && allowance && allowance.lt(ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals))) {
      // Approve token1
      console.log(`[INFO] Amount1Desired: ${ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals)}`)
      range.text("Approve", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          
          await approve(ctx, undefined, addToPoolApproveSuccessMenu, true, ctx.session.addToPoolData.token1, ethers.utils.parseUnits(ctx.session.addToPoolData.amount1Desired, ctx.session.addToPoolData.token1.decimals))
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Adding to Pool: `, error)
        }
      }).row();
    } else {
      range.text("Add", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          // await createPool(ctx)
          await createPool(ctx, addToPoolSuccessMenu, ctx.session.addToPoolData)
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Adding to Pool: `, error)
        }
      }).row();
    }

    range.text("Back", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          await ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error)
      }
    });
    return range;
  });

const swapMenu = new Menu<MainContext>("swap-menu")
.dynamic(async (ctx) => {

  const range = new MenuRange<MainContext>();

  const fromSymbol = ctx.session.swapData.fromToken.symbol
  const toSymbol = ctx.session.swapData.toToken.symbol

  const allowance = await getAllowance(ctx)

  range.text(fromSymbol);
  range.text("→", async (ctx) => {
    try {
      const fromToken = ctx.session.swapData.fromToken

      ctx.session.swapData.fromToken = ctx.session.swapData.toToken
      ctx.session.swapData.toToken = fromToken

      await swapTokensMenu(ctx)
    } catch (error) {
      console.error(`[ERROR] Swap Menu: ${error}`)
    }
  
  })
  range.text(toSymbol).row();
  range.text("Change amount", async (ctx) => {
    try {
      ctx.session.waitingForSwapAmount = true
      await ctx.editMessageText(ctx.session.wcConnected ? `Enter an amount to swap\\:` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? changeSwapAmountMenu : signInMenu, parse_mode: "MarkdownV2" })
    } catch (error) {
      ctx.session.waitingForSwapAmount = false
      console.error(`[ERROR] Changing Swap amount: ${error}`)
    }
  });
  range.text("Change slippage", async (ctx) => {
    try {
      ctx.session.waitingForSwapSlippage = true
      await ctx.editMessageText(ctx.session.wcConnected ? `Enter desired slippage \\[current: ${formatMD(String(ctx.session.swapData.slippage / 10))}\\%\\]\\:` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? changeSlippageAmountMenu : signInMenu, parse_mode: "MarkdownV2" })
    } catch (error) {
      ctx.session.waitingForSwapSlippage = false
      console.error(`[ERROR] Changing Slippage: ${error}`)
    }
  }).row();
  if (ctx.session.swapData.fromToken.address !== ETH_DATA.address && allowance && allowance.lt(ethers.utils.parseUnits(ctx.session.swapData.fromAmount, ctx.session.swapData.fromToken.decimals))) {
    // From is not ETH and allowance is less than fromAmount
    range.text("Approve", async (ctx) => {
      try {
        if (ctx.session.pendingTx) {
          console.log("[INFO] Transaction pending...")
          return
        }
        
        await approve(ctx, confirmSwapMenu, swapTransactionSubmittedMenu)
      } catch (error) {
        ctx.session.pendingTx = false
        await swapTokensMenu(ctx)
        console.error(`[ERROR] Approving tokens: `, error)
      }
    }).row();
  } else {
    range.text("Swap", async (ctx) => {
      try {
        if (ctx.session.pendingTx) {
          console.log("[INFO] Transaction pending...")
          return
        }
        if (ctx.session.swapData.fromAmount === "0") {
          await ctx.reply("Please enter an amount to swap")
          return
        }
        
        await swap(ctx, confirmSwapMenu, swapTransactionSubmittedMenu)
      } catch (error : any) { // TODO
        ctx.session.pendingTx = false
        console.error(`[ERROR] Swapping tokens: `, error)
        if (error.message.includes("User rejected the transaction")) {
          await swapTokensMenu(ctx)
        } else {
          await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
        }
      }
    }).row();
  }
  range.text("Back", async (ctx) => {
    try {
      await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
    } catch (error) {
      console.error(`[ERROR] Back to Main Menu from Swap Menu: ${error}`)
    }
  });
  return range;
})

const changePooledAmountMenu = new Menu<MainContext>("change-pooled-amount-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Back", async (ctx) => {
      ctx.session.waitingForPoolAmount0 = false
      ctx.session.waitingForPoolAmount1 = false
      try {
        await ctx.editMessageText(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu })
      } catch (error) {
        console.error(`[ERROR] Back to Pools Menu from Change Pooled Amount Menu: `, error)
      }
    });
    return range;
  });

  const changePooledAddAmountMenu = new Menu<MainContext>("change-pooled-add-amount-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Back", async (ctx) => {
      ctx.session.waitingForAddPoolAmount0 = false
      ctx.session.waitingForAddPoolAmount1 = false
      try {
        if (ctx.session.selectedPool) {
          await ctx.editMessageText(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Position Menu from Change Pooled Amount Menu: `, error)
      }
    });
    return range;
  });

const changeSwapAmountMenu = new Menu<MainContext>("change-swap-amount-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();
    range.text("Back", async (ctx) => {
      try {
        ctx.session.waitingForSwapAmount = false
        await swapTokensMenu(ctx)
      } catch (error) {
        console.error(`[ERROR] Back to Swap Menu from Amount Menu: `, error)
      }
    });
    return range;
  });

const changeSlippageAmountMenu = new Menu<MainContext>("change-slippage-amount-menu")
.dynamic(() => {
  const range = new MenuRange<MainContext>();
  range.text("Back", async (ctx) => {
    try {
      ctx.session.waitingForSwapSlippage = false
      await swapTokensMenu(ctx)
    } catch (error) {
      console.error(`[ERROR] Back to Swap Menu from Slippage Amount Menu: ${error}`)
    }
  });
  return range;
});

const removePoolApprovalSuccessMenu = new Menu<MainContext>("remove-pool-approve-success-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();

    range.text("Close", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          await ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu })
        } else {
          await ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error)
      }
    });

    return range;
  });

const removePoolMenu = new Menu<MainContext>("remove-pool-menu")
  .dynamic(async (ctx) => {
    const range = new MenuRange<MainContext>();

    let allowance = undefined

    if (ctx.session.selectedPool) {
      console.log(`[INFO] Checking allowance for VERSA-V2...`)
      allowance = await getAllowance(ctx, ctx.session.selectedPool.pairAddress) as ethers.BigNumber
      console.log(`[INFO] Allowance for VERSA-V2: ${allowance}`)
      console.log(`[INFO] LP Tokens to burn ${ctx.session.removePoolData.balance.mul(ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100)}`)
    }

    range.text("25%", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          ctx.session.removePoolData.percentage = 25
          ctx.session.removePoolData.amount0Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(25).div(100)))
          ctx.session.removePoolData.amount1Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(25).div(100)))
          await ctx.editMessageText(`Removing 25% of your position in ${ctx.session.selectedPool?.token0.symbol}/${ctx.session.selectedPool?.token1.symbol}\n\nPooled ${ctx.session.selectedPool?.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token0Reserve)}\nPooled ${ctx.session.selectedPool?.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool?.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool?.token1.symbol}`, { reply_markup: removePoolMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Removing Pool: `, error)
      }
    });

    range.text("50%", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          ctx.session.removePoolData.percentage = 50
          ctx.session.removePoolData.amount0Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(50).div(100)))
          ctx.session.removePoolData.amount1Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(50).div(100)))
          await ctx.editMessageText(`Removing 50% of your position in ${ctx.session.selectedPool?.token0.symbol}/${ctx.session.selectedPool?.token1.symbol}\n\nPooled ${ctx.session.selectedPool?.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token0Reserve)}\nPooled ${ctx.session.selectedPool?.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool?.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool?.token1.symbol}`, { reply_markup: removePoolMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Removing Pool: `, error)
      }
    }).row();

    range.text("75%", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          ctx.session.removePoolData.percentage = 75
          ctx.session.removePoolData.amount0Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(75).div(100)))
          ctx.session.removePoolData.amount1Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(75).div(100)))
          await ctx.editMessageText(`Removing 75% of your position in ${ctx.session.selectedPool?.token0.symbol}/${ctx.session.selectedPool?.token1.symbol}\n\nPooled ${ctx.session.selectedPool?.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token0Reserve)}\nPooled ${ctx.session.selectedPool?.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool?.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool?.token1.symbol}`, { reply_markup: removePoolMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Removing Pool: `, error)
      }
    });

    range.text("100%", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          ctx.session.removePoolData.percentage = 100
          ctx.session.removePoolData.amount0Desired = ctx.session.selectedPool.token0Reserve
          ctx.session.removePoolData.amount1Desired = ctx.session.selectedPool.token1Reserve
          await ctx.editMessageText(`Removing 100% of your position in ${ctx.session.selectedPool?.token0.symbol}/${ctx.session.selectedPool?.token1.symbol}\n\nPooled ${ctx.session.selectedPool?.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token0Reserve)}\nPooled ${ctx.session.selectedPool?.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool?.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool?.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool?.token1.symbol}`, { reply_markup: removePoolMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Removing Pool: `, error)
      }
    }).row();

    range.text("Manual Percentage", async (ctx) => {
      try {
        ctx.session.waitingForRemovePoolAmount = true
        await ctx.editMessageText("Enter a percentage to remove: ", { reply_markup: changePercentageRemovePoolMenu })
      } catch (error) {
        ctx.session.waitingForRemovePoolAmount = false
        console.error(`[ERROR] Manual Percentage: `, error)
      }
    }).row();

    if (allowance && allowance.lt(ctx.session.removePoolData.balance.mul(ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100))) {
      range.text("Approve", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          if (ctx.session.selectedPool) {
            await approve(ctx, undefined, removePoolApprovalSuccessMenu, true, ctx.session.selectedPool.pairAddress, ctx.session.removePoolData.balance.mul(ethers.BigNumber.from(ctx.session.removePoolData.percentage)).div(100))
          }
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Removing Pool: `, error)
        }
      }).row();
    } else {
      range.text("Remove", async (ctx) => {
        try {
          if (ctx.session.pendingTx) {
            console.log("[INFO] Transaction pending...")
            return
          }
          await removePool(ctx, removePoolSuccessMenu, ctx.session.selectedPool, ctx.session.removePoolData)
        } catch (error) {
          ctx.session.pendingTx = false
          console.error(`[ERROR] Removing Pool: `, error)
        }
      }).row();
    }

    range.text("Back", async (ctx) => {
      try {
        if (ctx.session.selectedPool) {
          await ctx.editMessageText(`Your position for ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYour share of the pool: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.percentageOfOwnership * 100)}%`, { reply_markup: positionPoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error)
      }
    });

    return range;
  });

const changePercentageRemovePoolMenu = new Menu<MainContext>("change-percentage-remove-pool-menu")
  .dynamic(() => {
    const range = new MenuRange<MainContext>();

    range.text("Back", async (ctx) => {
      try {
        ctx.session.waitingForRemovePoolAmount = false
        
        if (ctx.session.selectedPool) {
          await ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu })
        } else {
          await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
        }
      } catch (error) {
        console.error(`[ERROR] Back to Position Menu from Add to Pool Menu: `, error)
      }
    });

    return range;
  });

signInMenu.register(mainMenu)
signInMenu.register(wcMenu)
mainMenu.register(swapMenu)
mainMenu.register(aiMenu)
mainMenu.register(poolsMenu)
mainMenu.register(errorMenu)
swapMenu.register(changeSwapAmountMenu)
swapMenu.register(changeSlippageAmountMenu)
swapMenu.register(confirmSwapMenu)
swapMenu.register(swapTransactionSubmittedMenu)
poolsMenu.register(createPoolMenu)
poolsMenu.register(positionPoolMenu)
positionPoolMenu.register(addToPoolMenu)
positionPoolMenu.register(removePoolMenu)
addToPoolMenu.register(changePooledAddAmountMenu)
addToPoolMenu.register(addToPoolApproveSuccessMenu)
addToPoolMenu.register(addToPoolSuccessMenu)
removePoolMenu.register(removePoolApprovalSuccessMenu)
removePoolMenu.register(removePoolSuccessMenu)
removePoolMenu.register(changePercentageRemovePoolMenu)
createPoolMenu.register(changePooledAmountMenu)
createPoolMenu.register(createPoolSuccessMenu)

// Create bot instance and initialize session middleware

const bot = new Bot<MainContext>(process.env.BOT_TOKEN!);

bot.use(session({ initial: () => ({ 
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
        decimals: 18
      },
      fromAmount: "0",
      slippage: 5, // 0.5% | amount * 5 / 1000
      pairAddress: VERSADEX_CONTRACTS.pair,
    },
    createPoolData: {
      token0: ETH_DATA,
      token1: {
        name: "Versadex",
        symbol: "VDX",
        address: VERSADEX_CONTRACTS.token,
        decimals: 18
      },
      amount0Desired: "0",
      amount1Desired: "0",
      pairAddress: VERSADEX_CONTRACTS.pair,
      slippage: 10 // 1% | amount * 10 / 1000
    },
    addToPoolData: {
      token0: null,
      token1: null,
      amount0Desired: "0",
      amount1Desired: "0",
      pairAddress: NULL_ADDRESS,
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
    selectedPool: NULL_ADDRESS
  } as any) } // TODO: Add confirmation page for swap
));

bot.use(signInMenu)

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.session.wcConnected ? `💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\`` : "Welcome to VersaBot\\!", { reply_markup: ctx.session.wcConnected ? mainMenu : signInMenu, parse_mode: "MarkdownV2" })
});

bot.on("message:text", async (ctx) => {
  if (ctx.session.waitingForSwapAmount) {
    try {
      ethers.utils.parseUnits(ctx.message.text, ctx.session.swapData.fromToken.decimals)

      ctx.session.swapData.fromAmount = ctx.message.text
      ctx.session.waitingForSwapAmount = false

      await ctx.reply(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${formatMD(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${formatMD(await getSwapRate(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2"})
    } catch (error) {
      console.error(`[ERROR] Parsing amount: ${error}`)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changeSwapAmountMenu })
    }
  } else if (ctx.session.waitingForSwapSlippage) {
    try {
      let slippage = Number(ctx.message.text)

      if (isNaN(slippage)) {
        throw new Error("Slippage must be a number")
      }

      if (slippage < 0 || slippage > 100) {
        throw new Error("Slippage must be between 0 and 100")
      }

      slippage = Number((slippage * 10).toFixed(0))

      console.log(`[INFO] Setting slippage to ${slippage / 10}%...`)

      ctx.session.swapData.slippage = slippage
      ctx.session.waitingForSwapSlippage = false

      await ctx.reply(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${formatMD(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${formatMD(await getSwapRate(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2"})
    } catch (error) {
      console.error(`[ERROR] Parsing amount: ${error}`)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [0-100 range and a maximum of one decimal separated by a dot]`, { reply_markup: changeSlippageAmountMenu })
    }
  } else if (ctx.session.waitingForAIPrompt) {
    try {
      console.log(`[INFO] Processing request: ${ctx.message.text}...`)
      
      if (!ctx.session.wcConnected || !ctx.session.address || !ctx.session.wcProvider) {
        await signOut(ctx)
        return
      }

      if (ctx.message.text.length > 200) {
        console.error(`[ERROR] Message too long: ${ctx.message.text}`)
        await ctx.reply("🤖 Welcome to VersaAI! 🤖\n\nMaximum 200 characters.", { reply_markup: aiMenu })
        return
      }

      const processing_msg = await ctx.reply("Processing your request...")

      const params = await processRequest(ctx.message.text)

      if (!params) {
        throw new Error("Error processing request")
      }

      if (params[0] === "swapExactETHForTokens") {
        ctx.session.swapData.fromToken = ETH_DATA
        ctx.session.swapData.fromAmount = params[1]
        ctx.session.swapData.slippage = Number(params[2]) === 0 ? 5 : Number(params[2])
        
        

        if (params[4] === "VDX") {
          ctx.session.swapData.toToken = {
            name: "Versadex",
            symbol: "VDX",
            address: VERSADEX_CONTRACTS.token,
            decimals: 18
          }

        } else {
          // TODO: Now only supports VDX
          if (params[3].toLowerCase() === VERSADEX_CONTRACTS.token.toLowerCase()) {
            const data = await getERC20Data(ctx, params[3])

            ctx.session.swapData.toToken = {
              name: data.name,
              symbol: data.symbol,
              address: data.address,
              decimals: data.decimals
            }
          } else {
            console.error(`[ERROR] Processing request: Only VDX supported for now.`)
            await ctx.api.editMessageText(processing_msg.chat.id, processing_msg.message_id, "🤖 Welcome to VersaAI! 🤖\n\nOnly VDX is supported for now.", { reply_markup: aiMenu })
            return
          }
        }

        ctx.session.waitingForAIPrompt = false

        await swap(ctx, confirmSwapMenu, swapTransactionSubmittedMenu, true, processing_msg.message_id, true)
      } else if (params[0] === "swapExactTokensForETH") {
        ctx.session.swapData.toToken = ETH_DATA
        ctx.session.swapData.fromAmount = params[1]
        ctx.session.swapData.slippage = Number(params[2]) === 0 ? 5 : Number(params[2])
        
        if (params[4] === "VDX") {
          ctx.session.swapData.fromToken = {
            name: "Versadex",
            symbol: "VDX",
            address: VERSADEX_CONTRACTS.token,
            decimals: 18
          }
        } else {
          // TODO: Now only supports VDX
          if (params[3].toLowerCase() === VERSADEX_CONTRACTS.token.toLowerCase()) {
            const data = await getERC20Data(ctx, params[3])

            ctx.session.swapData.fromToken = {
              name: data.name,
              symbol: data.symbol,
              address: data.address,
              decimals: data.decimals
            }
          } else {
            console.error(`[ERROR] Processing request: Only VDX supported for now.`)
            await ctx.api.editMessageText(processing_msg.chat.id, processing_msg.message_id, "🤖 Welcome to VersaAI! 🤖\n\nOnly VDX is supported for now.", { reply_markup: aiMenu })
            return
          }
        }

        ctx.session.waitingForAIPrompt = false

         await swap(ctx, confirmSwapMenu, swapTransactionSubmittedMenu, true, processing_msg.message_id, true)
      }
    } catch (error) {
      console.error(`[ERROR] Processing request: `, error)
      ctx.session.waitingForAIPrompt = true
      await ctx.reply("🤖 Welcome to VersaAI! 🤖\n\nError processing your request.", { reply_markup: aiMenu })
    }
  } else if (ctx.session.waitingForPoolAmount0) {
    try {
      ethers.utils.parseUnits(ctx.message.text, ctx.session.createPoolData.token0.decimals)

      ctx.session.createPoolData.amount0Desired = ctx.message.text

      if (ctx.session.createPoolData.pairAddress !== NULL_ADDRESS) {
        await getLiquidityRatio(ctx, "1")
      }

      ctx.session.waitingForPoolAmount0 = false

      await ctx.reply(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu })
    } catch (error) {
      console.error(`[ERROR] Parsing amount: `, error)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAmountMenu })
    }
  } else if (ctx.session.waitingForPoolAmount1) {
    try {
      ethers.utils.parseUnits(ctx.message.text, ctx.session.createPoolData.token1.decimals)

      ctx.session.createPoolData.amount1Desired = ctx.message.text

      if (ctx.session.createPoolData.pairAddress !== NULL_ADDRESS) {
        await getLiquidityRatio(ctx, "0")
      }

      ctx.session.waitingForPoolAmount1 = false

      await ctx.reply(`New position of ${ctx.session.createPoolData.token0.symbol}/${ctx.session.createPoolData.token1.symbol}\n\n${ctx.session.createPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token0, false))}\n${ctx.session.createPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.createPoolData.token1, false))}\n\nAmount of ${ctx.session.createPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount0Desired)}\nAmount of ${ctx.session.createPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.createPoolData.amount1Desired)}\n`, { reply_markup: createPoolMenu })
    } catch (error) {
      console.error(`[ERROR] Parsing amount: `, error)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAmountMenu })
    }
  } else if (ctx.session.waitingForAddPoolAmount0) {
    try {
      ethers.utils.parseUnits(ctx.message.text, ctx.session.addToPoolData.token0.decimals)

      ctx.session.addToPoolData.amount0Desired = ctx.message.text

      if (ctx.session.addToPoolData.pairAddress !== NULL_ADDRESS) {
        await getLiquidityRatio(ctx, "1", false)
      }

      ctx.session.waitingForAddPoolAmount0 = false

      await ctx.reply(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu })
    } catch (error) {
      console.error(`[ERROR] Parsing amount: `, error)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAddAmountMenu })
    }
  } else if (ctx.session.waitingForAddPoolAmount1) {
    try {
      ethers.utils.parseUnits(ctx.message.text, ctx.session.addToPoolData.token1.decimals)

      ctx.session.addToPoolData.amount1Desired = ctx.message.text

      if (ctx.session.addToPoolData.pairAddress !== NULL_ADDRESS) {
        await getLiquidityRatio(ctx, "0", false)
      }

      ctx.session.waitingForAddPoolAmount1 = false

      await ctx.reply(`New position of ${ctx.session.addToPoolData.token0.symbol}/${ctx.session.addToPoolData.token1.symbol}\n\n${ctx.session.addToPoolData.token0.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token0, false))}\n${ctx.session.addToPoolData.token1.symbol} balance: ${roundToFirstNonZeroDecimal(await getBalance(ctx, ctx.session.addToPoolData.token1, false))}\n\nAmount of ${ctx.session.addToPoolData.token0.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount0Desired)}\nAmount of ${ctx.session.addToPoolData.token1.symbol} to pool: ${roundToFirstNonZeroDecimal(ctx.session.addToPoolData.amount1Desired)}\n`, { reply_markup: addToPoolMenu })
    } catch (error) {
      console.error(`[ERROR] Parsing amount: `, error)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [Less than 18 decimals separated by a dot]`, { reply_markup: changePooledAddAmountMenu })
    }
  } else if (ctx.session.waitingForRemovePoolAmount) {
    try {
      let percentage = Number(ctx.message.text)

      if (isNaN(percentage)) {
        throw new Error("Percentage must be a number")
      }

      if (percentage < 0 || percentage > 100) {
        throw new Error("Percentage must be between 0 and 100")
      }

      // Round it

      percentage = Math.round(percentage)

      if (ctx.session.selectedPool) {
        ctx.session.removePoolData.percentage = percentage
        ctx.session.removePoolData.amount0Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token0Reserve)).mul(percentage).div(100)))
        ctx.session.removePoolData.amount1Desired = Number(ethers.utils.formatEther(ethers.utils.parseEther(String(ctx.session.selectedPool.token1Reserve)).mul(percentage).div(100)))
      }

      ctx.session.waitingForRemovePoolAmount = false

      if (ctx.session.selectedPool) {
        await ctx.reply(`Removing ${ctx.session.removePoolData.percentage}% of your position in ${ctx.session.selectedPool.token0.symbol}/${ctx.session.selectedPool.token1.symbol}\n\nPooled ${ctx.session.selectedPool.token0.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token0Reserve)}\nPooled ${ctx.session.selectedPool.token1.symbol}: ${roundToFirstNonZeroDecimal(ctx.session.selectedPool.token1Reserve)}\n\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount0Desired)} ${ctx.session.selectedPool.token0.symbol}\nYou will receive: ${roundToFirstNonZeroDecimal(ctx.session.removePoolData.amount1Desired)} ${ctx.session.selectedPool.token1.symbol}`, { reply_markup: removePoolMenu })
      } else {
        await ctx.reply("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      }
    } catch (error) {
      console.error(`[ERROR] Parsing amount: `, error)
      await ctx.reply(`Invalid amount: ${ctx.message.text}\n\nPlease enter a valid amount. [0 - 100]`, { reply_markup: changePercentageRemovePoolMenu })
    }
  }
});

async function aiChatMenu(ctx: MainContext) {
  const aiEnabled = true
  if (aiEnabled) {
    ctx.session.waitingForAIPrompt = true

    await ctx.editMessageText("🤖 Welcome to VersaAI! 🤖\n\nPlease enter a message explaining the transaction that you want to perform.", { reply_markup: aiMenu })
  } else {
    await ctx.editMessageText("🤖 Welcome to VersaAI! 🤖\n\nAI is currently disabled. Try again later.", { reply_markup: aiMenu })
  }
}

async function swapTokensMenu(ctx: MainContext) {
  await ctx.editMessageText(`Swap ${ctx.session.swapData.fromToken.symbol} for ${ctx.session.swapData.toToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.fromToken)} ${ctx.session.swapData.fromToken.symbol}\n\n💰 \\- ${await getBalance(ctx, ctx.session.swapData.toToken)} ${ctx.session.swapData.toToken.symbol}\n\nSwap ${formatMD(ctx.session.swapData.fromAmount)} ${ctx.session.swapData.fromToken.symbol}\n\nReceive ${formatMD(await getSwapRate(ctx))} ${ctx.session.swapData.toToken.symbol}`, { reply_markup: swapMenu, parse_mode: "MarkdownV2"})
}

async function liquidityPoolsMenu(ctx: MainContext) {
  try {
    if (ctx.session.loadingLiquidityPools) {
      await ctx.editMessageText("Loading liquidity pools...", { reply_markup: undefined })
  
      const interval = setInterval(async () => {
        if (!ctx.session.loadingLiquidityPools) {
          clearInterval(interval)
          if (ctx.session.pools.length === 0) {
            await ctx.editMessageText("No liquidity pools available. Create your first one with the button below!", { reply_markup: poolsMenu })
          } else {
            await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
          }
        } 
      }, 200);
    } else {
      if (ctx.session.pools.length === 0) {
        await ctx.editMessageText("No liquidity pools available. Create your first one with the button below!", { reply_markup: poolsMenu })
      } else {
        await ctx.editMessageText("Press on the pool to see more details or create a new position", { reply_markup: poolsMenu })
      }
    }
  } catch (error) {
    console.error(`[ERROR] Liquidity Pools Menu: `, error)
    await ctx.editMessageText("Error loading liquidity pools...", { reply_markup: errorMenu })
  }
}

async function connectWallet(ctx: MainContext) {
  ctx.session.wcProvider = await EthereumProvider.init({
  projectId: process.env.WC_PROJECT_ID!,
  chains: [11155111],
  showQrModal: false,
  storageOptions: {
    database: "walletconnect",       // Name of the database
    table: "sessions",               // Name of the table within the database (optional)
  
  },
  metadata: {
      name: 'Versadex',
      description: 'DeFi in your own way',
      url: 'https://versadex.finance/',
      icons: ['']
    }
  });

  ctx.session.wcProvider.on("display_uri", async (uri: any) => {
    ctx.session.wcUri = uri
    console.log(`[INFO] WalletConnect URI: ${uri}`);
    await ctx.editMessageText("Connect your wallet", {reply_markup: wcMenu})
  });

  ctx.session.wcProvider.on("accountsChanged", async (data: any) => {
    try {
      console.log("[INFO] Changing wallet...")
      if (data.length > 0) {
        try {
          ctx.session.address = data[0]
          ctx.session.wcConnected = true
          console.log(`[INFO] Wallet changed to ${ctx.session.address}`)
        } catch (error) {
          console.error(`[ERROR] Changing wallet: ${error}`)
        }
      } else {
        await signOut(ctx)
        return
      }
    } catch (error) {
      console.error(`[ERROR] Changing wallet: `, error)
      ctx.editMessageText("Welcome to VersaBot!", {reply_markup: signInMenu})
    }
  });

  ctx.session.wcProvider.connect()
    .then(async () => {
      ctx.session.wcConnected = true
      console.log("[INFO] Connecting wallet...")
      const pairings = ctx.session.wcProvider.signer.client.pairing.getAll({ active: true });
      console.log(`[INFO] Active pairings: `, pairings);
      getLiquidityPools(ctx)
      await ctx.editMessageText(`💰 \\- ${await getBalance(ctx, ETH_DATA)} ETH\n\`${ctx.session.address}\``, { reply_markup: mainMenu, parse_mode: "MarkdownV2" })
    })
    .catch((error: any) => {
      console.error("[ERROR] Connecting with WalletConnect:", error);
      ctx.editMessageText("Welcome to VersaBot!", {reply_markup: signInMenu})
  });
}

async function signOut(ctx: MainContext) {
  try {
    if (ctx.session.address && ctx.session.wcProvider) {
      console.log(`[INFO] Signing out from ${ctx.session.address}...`)
      await ctx.session.wcProvider.disconnect()
    }
    ctx.editMessageText("Welcome to VersaBot!", {reply_markup: signInMenu})
  } catch (error) {
    console.error(`[ERROR] Signing out: `, error)
  } finally {
    ctx.session.wcProvider = null
    ctx.session.wcConnected = false
    ctx.session.wcUri = undefined
    ctx.session.address = undefined
  }

  // try {
  //   await ctx.editMessageText("Welcome to VersaBot!", {reply_markup: signInMenu})
  // } catch (error) {
  //   console.error(`[ERROR] Signing out: `, error)
  // }
}

console.log("[START] Starting the bot...")

bot.start()


// Catch error and restart the bot

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
})