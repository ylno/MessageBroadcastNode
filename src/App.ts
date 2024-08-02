import { KonvBot } from "./KonvBot";
import { DataService } from "./DataService";
import { ChatDAO } from "./ChatDao";
import eventBus from "./EventBus";
import { startRestServer } from "./rest/server";
import dotenv from "dotenv";
dotenv.config();

function main() {
  const botKey = process.env.TELEGRAM_BOT_TOKEN;
  const botName = process.env.BOT_NAME;
  const redisHost = process.env.REDIS_HOST;
  if (!botKey || !botName || redisHost == undefined) {
    throw new Error("app secrets not defined.");
  }
  const dataService = new DataService(new ChatDAO(redisHost));
  new KonvBot(eventBus, botKey, botName, dataService);
  startRestServer();
}

main();
