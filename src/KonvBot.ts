import { Telegraf, Context, Markup, TelegramError } from "telegraf";
import winston from "winston";
import { DataService } from "./DataService";
import eventBus, { EventBus } from "./EventBus";
import { callbackQuery, message } from "telegraf/filters";
import { Channel } from "./ChatDao";

class Emoji {
  static CROSS_MARK = "❌";
}

export interface MessageEvent {
  channel: string;
  message: string;
}

// Main Bot Class
export class KonvBot {
  private static readonly MAX_TELEGRAM_MESSAGE_SIZE = 4096;
  private static readonly VERSION = "1.1.1";
  private bot: Telegraf<Context>;
  private dataService: DataService;
  private logger: winston.Logger;

  constructor(
    eventBus: EventBus,
    botKey: string,
    botName: string,
    dataService: DataService,
  ) {
    this.bot = new Telegraf(botKey);
    this.dataService = dataService;
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "konvbot.log" }),
      ],
    });

    this.bot.command("test", async (ctx) => {
      console.log("test", ctx);
    });

    eventBus.on("messageEvent", this.messageHandler.bind(this));

    this.bot.on(message("text"), (ctx) => this.chatMessage(ctx));
    this.bot.on(callbackQuery(), (ctx) => this.callbackQuery(ctx));
    this.bot.launch();
  }

  async callbackQuery(ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    console.log("callbackquery", callbackQuery);
    const command = ctx.text;
    if (!command) {
      return;
    }
    // const command = callbackQuery;
    console.log("callbackQuery", callbackQuery);
    const [action, target] = command.split("/");

    this.logger.debug(`data ${action} target ${target}`);

    if (action === "ACTIVATECHANNEL") {
      // Implement activation logic
    } else if (action === "EDITCHANNEL") {
      // Implement edit logic
    } else if (action === "DELETECHANNEL") {
      // Implement delete logic
    } else if (action === "INFOCHANNEL") {
      // Implement info logic
    }
  }

  async chatMessage(ctx: Context) {
    const message = ctx.message;
    if (!message) {
      throw new Error("no message");
    }
    const chatId = String(message.chat.id);

    const text = ctx.text || "";
    console.log("incoming", text);
    const user = this.dataService.getChatDao().getUser(String(message.from.id));

    const waitfor = await this.dataService
      .getChatDao()
      .getAndDeleteWaitFor(chatId);
    console.log("found waitfor", waitfor);

    if (waitfor && waitfor == "channelname") {
      console.log("lkjaslkdjs");
      const channel = await this.dataService
        .getChatDao()
        .createChannel(user, text);
      this.logger.debug("chat: ", channel);
      this.dataService.getChatDao().persistChannel(channel);

      ctx.reply("channel " + channel.name + " created and activated here");
    } else if (text.toLowerCase() === "help" || text === "/start") {
      await ctx.reply(this.getHelpText(), {
        parse_mode: "HTML",
        ...Markup.keyboard(this.getMainMenuKeyboard()).resize(),
      });
    } else if (text === "LIST") {
      // Implement list logic
    } else if (text.toLowerCase() === "new channel") {
      ctx.reply("Give me a name for the channel");
      this.dataService.getChatDao().setWaitFor(chatId, "channelname");
    } else if (text === "Channels") {
      // Implement channels logic
    } else if (text === "ACTIVATE") {
      // Implement activate logic
    } else if (text.toLowerCase() === "/stats") {
      // Implement stats logic
    } else {
      await ctx.reply(
        "I did not understand that. Try HELP",
        Markup.keyboard(this.getMainMenuKeyboard()).resize(),
      );
    }
  }

  private getHelpText(): string {
    return `Use this bot to receive telegram messages from anywhere. Receive your server-monitoring messages in telegram, filled out web-forms etc. All you need is to send a post message.\n\n
        A channel is an input channel for messages. You can have many channels, they are bound to your telegram user.
        
        Activate a channel in any chat to receive messages. The @KonvBot must be included in this channel. One channel can be activated in many chats. Messages to this channel will be broadcasted to every chat it is activated in.\n\n
        Messages to a channel can be sent with a post-message from anywhere. Structure of the post message: '{"target": "channel-id","message": "{your message}"}'
        
        channel-id: the channel-id, get it from your channel-list
        {your message}: send the text that should be sent to telegram.
        
        curl-example:\ncurl -H "Content-Type: application/json" -X POST -d '{"target": "9288ec3b-c32c-482d-b9a1-06b08df9aaba","message": "This is a telegram message"}' https://message.frankl.info/message\n\n
        Version: ${KonvBot.VERSION}`;
  }

  private getMainMenuKeyboard() {
    return [["Help", "Channels", "New Channel"]];
  }

  private async messageHandler(messageEvent: MessageEvent) {
    this.logger.debug("received messageEvent", messageEvent);

    try {
      const channel = await this.dataService
        .getChatDao()
        .getChannel(messageEvent.channel);
      for (const target of channel.getTargetList()) {
        const messages = this.splitStringIntoParts(
          messageEvent.message,
          KonvBot.MAX_TELEGRAM_MESSAGE_SIZE,
        );
        for (const part of messages) {
          await this.bot.telegram.sendMessage(target, part);
        }
      }
      channel.increaseMessageCount();
      this.dataService.getChatDao().persistChannel(channel);
      this.dataService.increaseMessageCount();
    } catch (error) {
      this.logger.error("Error processing messageEvent", error);
    }
  }

  private splitStringIntoParts(message: string, length: number): string[] {
    const parts: string[] = [];
    for (let i = 0; i < message.length; i += length) {
      parts.push(message.substring(i, i + length));
    }
    return parts;
  }
}
