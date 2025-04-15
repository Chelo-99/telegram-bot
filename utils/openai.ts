import OpenAI from "openai";

async function processRequest(prompt: string) : Promise<Array<string> | null> {
  try {
    console.log(`[INFO] Processing AI request...`)

    const openai = new OpenAI()

    const thread = await openai.beta.threads.create()

    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: prompt
      }
    )

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id
    );

    // TODO: Make more efficient
    while (runStatus.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);

    const lastMessageForRun = messages.data
      .filter(
        (message) => message.run_id === run.id && message.role === "assistant"
      )
      .pop();

      
    // const swapInfo = JSON.parse(JSON.stringify(lastMessageForRun?.content[0])).text.value
    const swapInfo = JSON.parse(JSON.stringify(lastMessageForRun?.content[0])).text.value

    console.log(JSON.parse(swapInfo));

    // const swapInfoArray = swapInfo.split(",")
    const swapInfoArray = JSON.parse(swapInfo)

    console.log(`[INFO] Swap info: `, swapInfoArray)
    console.log(swapInfoArray.length);
    
    if (swapInfoArray.length !== 5) {
      throw new Error("Missing details in swapInfoArray")
    }

    return swapInfoArray
  } catch (error) {
    console.error(`[ERROR] Processing request: `, error)
    return null
  }
}

export { processRequest }