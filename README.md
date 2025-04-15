# VersaDex bot

Telegram for of VersaDex.

## How to run

To start the bot run the following command:

```
./run.sh
```

## Bot configuration

All the configuration is done in the [index.ts](index.ts) file.

At the beginning of the file you can find the variables below. Set the corresponding values.

```
const botToken = ""
const wcProjId = ""
```

To configure the chain (Mainnet, sepolia...) modify the parameter `chains` when creating the provider.

```
async function connectWallet(ctx: MainContext) {
  ctx.session.wcProvider = await EthereumProvider.init({
  projectId: wcProjId,
  chains: [5],
```

