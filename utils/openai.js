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
exports.processRequest = void 0;
const openai_1 = __importDefault(require("openai"));
function processRequest(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`[INFO] Processing AI request...`);
            const openai = new openai_1.default();
            const thread = yield openai.beta.threads.create();
            yield openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: prompt
            });
            const run = yield openai.beta.threads.runs.create(thread.id, {
                assistant_id: process.env.OPENAI_ASSISTANT_ID,
            });
            let runStatus = yield openai.beta.threads.runs.retrieve(thread.id, run.id);
            // TODO: Make more efficient
            while (runStatus.status !== "completed") {
                yield new Promise((resolve) => setTimeout(resolve, 2000));
                runStatus = yield openai.beta.threads.runs.retrieve(thread.id, run.id);
            }
            const messages = yield openai.beta.threads.messages.list(thread.id);
            const lastMessageForRun = messages.data
                .filter((message) => message.run_id === run.id && message.role === "assistant")
                .pop();
            // const swapInfo = JSON.parse(JSON.stringify(lastMessageForRun?.content[0])).text.value
            const swapInfo = JSON.parse(JSON.stringify(lastMessageForRun === null || lastMessageForRun === void 0 ? void 0 : lastMessageForRun.content[0])).text.value;
            console.log(JSON.parse(swapInfo));
            // const swapInfoArray = swapInfo.split(",")
            const swapInfoArray = JSON.parse(swapInfo);
            console.log(`[INFO] Swap info: `, swapInfoArray);
            console.log(swapInfoArray.length);
            if (swapInfoArray.length !== 5) {
                throw new Error("Missing details in swapInfoArray");
            }
            return swapInfoArray;
        }
        catch (error) {
            console.error(`[ERROR] Processing request: `, error);
            return null;
        }
    });
}
exports.processRequest = processRequest;
