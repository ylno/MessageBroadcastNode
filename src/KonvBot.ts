import { Context, Markup, Telegraf } from "telegraf";
import { DataService } from "./DataService";
import { EventBus } from "./EventBus";
import { message } from "telegraf/filters";
import { Channel, User } from "./ChatDao";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { Message } from "./types";

// Main Bot Class
export class KonvBot {
  private static readonly MAX_TELEGRAM_MESSAGE_SIZE = 4096;
  private static readonly VERSION = "1.1.1";
  private bot: Telegraf<Context>;
  private dataService: DataService;

  constructor(eventBus: EventBus, botKey: string, botName: string, dataService: DataService) {
    this.bot = new Telegraf(botKey);
    this.dataService = dataService;

    this.bot.command("test", async (ctx) => {
      console.log("test", ctx);
    });

    eventBus.on("message", (message: Message) => {
      console.log("noice", message);
      this.messageHandler(message)
        .then(() => {
          console.log("handler ready");
        })
        .catch((e) => {
          console.log("error", e);
        });
    });

    this.bot.on(message("text"), (ctx) => this.chatMessage(ctx));

    this.bot.action(/EDITCHANNEL\/(.+)/, (ctx) => {
      this.editChannelAction(ctx.match.input, ctx);
    });

    this.bot.action(/ACTIVATECHANNEL\/(.+)/, (ctx) => {
      this.activateChannel(ctx.match[1], ctx);
    });

    this.bot.action(/DELETECHANNEL\/(.+)/, (ctx) => {
      this.deleteChannel(ctx.match[1], ctx);
    });

    this.bot.action(/INFOCHANNEL\/(.+)/, (ctx) => {
      this.infoChannel(ctx.match[1], ctx);
    });

    this.bot.launch();
  }

  async infoChannel(target: string, ctx: Context) {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery) return;

    const user = this.dataService.getChatDao().getUser(callbackQuery.from.id.toString());
    const channel = await this.dataService.getChatDao().getChannel(target);

    const channelInfo = this.getChannelInfo(channel);

    await ctx.reply(channelInfo);
  }

  async deleteChannel(target: string, ctx: Context) {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery) return;

    const user = this.dataService.getChatDao().getUser(callbackQuery.from.id.toString());
    const channel = await this.dataService.getChatDao().getChannel(target);

    this.dataService.getChatDao().deleteChannel(user, channel);

    await ctx.reply("Channel deleted");
  }

  async activateChannel(target: string, ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    const currentChatId = ctx.callbackQuery?.message?.chat.id;
    if (!callbackQuery) return;
    console.log("currentChatId", currentChatId);

    const user = this.dataService.getChatDao().getUser(callbackQuery.from.id.toString());
    console.log(`User: ${user.id}`);

    const channels = await this.dataService.getChatDao().getChannelsForUser(user);
    let foundChannel = false;

    if (!currentChatId) {
      ctx.reply("unable to get current chat");
      return;
    }

    for (const channel of channels) {
      if (channel.id.toString() === target) {
        foundChannel = true;
        if (!channel.hasTarget(currentChatId.toString())) {
          channel.addTarget(currentChatId.toString());
          this.dataService.getChatDao().persistChannel(channel);
          await ctx.answerCbQuery("Channel added");
        } else {
          channel.removeTarget(currentChatId.toString());
          this.dataService.getChatDao().persistChannel(channel);
          await ctx.answerCbQuery("Channel removed!");
        }
        console.log(`Target ${callbackQuery.message?.chat.id} added to channel ${channel.id}`);
      }
    }

    if (!foundChannel) {
      await ctx.answerCbQuery("Channel not found");
    }
  }

  async editChannelAction(input: string, ctx: Context) {
    const data = input;
    const channelId = data.split("/")[1];
    console.log(channelId); // Ausgabe der extrahierten Channel-ID

    const channel = await this.dataService.getChatDao().getChannel(channelId);
    const text = `what do you want to do with channel ${channel.name}`;

    const inlineKeyboardMarkup = Markup.inlineKeyboard([
      [
        Markup.button.callback("Info", `INFOCHANNEL/${channelId}`),
        Markup.button.callback("Activate", `ACTIVATECHANNEL/${channelId}`),
        Markup.button.callback("Delete", `DELETECHANNEL/${channelId}`),
      ],
    ]);

    await ctx.reply(text, inlineKeyboardMarkup);

    // Antwort auf die Callback-Query
    ctx.answerCbQuery("Channel edited");
    ctx.reply(`Channel ID to edit: ${channelId}`);
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

    const waitfor = await this.dataService.getChatDao().getAndDeleteWaitFor(chatId);
    console.log("found waitfor", waitfor);

    if (waitfor && waitfor == "channelname") {
      const channel = await this.dataService.getChatDao().createChannel(user, text);
      console.log("chat: ", channel);
      channel.addTarget(ctx.message.chat.id.toString());
      await this.dataService.getChatDao().persistChannel(channel);

      ctx.reply("channel " + channel.name + " created and activated here");
    } else if (text.toLowerCase() === "help" || text === "/start") {
      await ctx.reply(this.getHelpText(), {
        parse_mode: "HTML",
        ...Markup.keyboard(this.getMainMenuKeyboard()).resize(),
      });
    } else if (text.toUpperCase() === "LIST") {
      const channelsForUser = await this.dataService.getChatDao().getChannelsForUser(user);

      let answer = `Channellist for ${user.id}\n`;

      channelsForUser.map((channel) => {
        answer += this.getChannelInfo(channel) + "\n";
      });
      ctx.reply(answer, { parse_mode: "Markdown" });
    } else if (text.toLowerCase() === "new channel") {
      ctx.reply("Give me a name for the channel");
      this.dataService.getChatDao().setWaitFor(chatId, "channelname");
    } else if (text === "Channels") {
      ctx.reply("Choose channel to edit", await this.getChannellistKeyboard(chatId, user, "EDITCHANNEL"));
    } else if (text === "ACTIVATE") {
      // Implement activate logic
    } else if (text.toLowerCase() === "/stats") {
      await ctx.reply(await this.dataService.getMessageCount());
    } else {
      await ctx.reply("I did not understand that. Try HELP", Markup.keyboard(this.getMainMenuKeyboard()).resize());
    }
  }

  getChannelInfo(channel: Channel): string {
    let answer = channel.name + "\n";
    answer += " ID: " + channel.id + "\n";
    answer += " name: " + channel.name + "\n";
    answer += " messages: " + channel.messageCount + "\n";
    answer += " test channel: https://message.frankl.info/test?channelid=" + channel.id + "\n";
    answer +=
      "or use simple link to send receive a message: https://message.frankl.info/message/" +
      channel.id +
      "/This%20is%20a%20example%20message%20to%20telegram\n";
    return answer;
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

  async messageHandler(messageEvent: Message) {
    console.log("-------received messageEvent", messageEvent);

    try {
      const channel = await this.dataService.getChatDao().getChannel(messageEvent.target);
      console.log("found channel and target list length", channel, channel.targetList.length);
      for (const target of channel.getTargetList()) {
        const messages = this.splitStringIntoParts(messageEvent.message, KonvBot.MAX_TELEGRAM_MESSAGE_SIZE);
        for (const part of messages) {
          console.log("target, part", target, part);
          await this.bot.telegram.sendMessage(target, part);
        }
      }
      channel.increaseMessageCount();
      this.dataService.getChatDao().persistChannel(channel);
      this.dataService.increaseMessageCount();
    } catch (error) {
      console.log("Error processing messageEvent", error);
    }
  }

  splitStringIntoParts(message: string, length: number): string[] {
    const parts: string[] = [];
    for (let i = 0; i < message.length; i += length) {
      parts.push(message.substring(i, i + length));
    }
    return parts;
  }

  async getChannellistKeyboard(chatId: string, user: User, action: string) {
    const channels = await this.dataService.getChatDao().getChannelsForUser(user);
    const rows: InlineKeyboardButton[][] = [];
    let row: InlineKeyboardButton[] = [];

    let counter = 0;
    for (const channel of channels) {
      const emoji = channel.hasTarget(chatId) ? "❌" : "";

      const inlineKeyboardButton = Markup.button.callback(`${channel.name} ${emoji}`, `${action}/${channel.id}`);

      row.push(inlineKeyboardButton);
      counter++;
      if (counter === 4) {
        rows.push(row);
        row = [];
        counter = 0;
      }
    }

    if (counter !== 0) {
      rows.push(row);
    }

    return Markup.inlineKeyboard(rows);
  }
}
