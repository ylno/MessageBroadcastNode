import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import winston from "winston";

class User {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

class Channel {
  id: string;
  name: string;
  messageCount: number = 0;
  targetList: string[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addTarget(chatId: string) {
    this.targetList.push(chatId);
  }

  removeTarget(chatId: string) {
    this.targetList = this.targetList.filter((id) => id !== chatId);
  }

  hasTarget(chatId: string): boolean {
    return this.targetList.includes(chatId);
  }

  getTargetList(): string[] {
    return this.targetList;
  }

  increaseMessageCount() {
    this.messageCount++;
  }

  static create(name: string): Channel {
    return new Channel(uuidv4(), name);
  }
}

export class ChatDAO {
  private readonly BOTKEY = "konvbot";
  private redis: Redis;
  private logger: winston.Logger;

  constructor(redisHost: string) {
    this.redis = new Redis(redisHost);
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "chatdao.log" }),
      ],
    });
    this.logger.debug("jedis init now");
    this.logger.debug("jedis init", this.redis.toString());
  }

  getUser(id: string): User {
    return new User(id);
  }

  async getAndDeleteWaitFor(chatId: string): Promise<string | null> {
    const key = this.getKeyWaitFor(chatId);
    const waitfor = await this.redis.get(key);
    await this.redis.del(key);
    return waitfor;
  }

  private getKeyWaitFor(chatId: string): string {
    return `${this.BOTKEY}.chat.${chatId}.waitfor`;
  }

  async createChannel(user: User, channelName: string): Promise<Channel> {
    const channelsForUser = await this.getChannelsForUser(user);
    for (const presentChannel of channelsForUser) {
      if (presentChannel.name === channelName) {
        throw new Error("Channelname already present");
      }
    }
    const channel = Channel.create(channelName);
    await this.persistUserChannel(user, channel);
    return channel;
  }

  async persistChannel(channel: Channel): Promise<void> {
    const channelID = channel.id;
    const channelData: Record<string, string> = {
      name: channel.name,
      messagecount: channel.messageCount.toString(),
    };
    await this.redis.hmset(`${this.BOTKEY}.channel.${channelID}`, channelData);
    await this.redis.del(`${this.BOTKEY}.channeltarget.${channelID}`);
    for (const target of channel.getTargetList()) {
      await this.redis.lpush(
        `${this.BOTKEY}.channeltarget.${channelID}`,
        target,
      );
    }
  }

  async persistUserChannel(user: User, channel: Channel): Promise<void> {
    const channelID = channel.id;
    const channelsForUser = await this.getChannelsForUser(user);
    const present = channelsForUser.some(
      (storedChannel) => storedChannel.id === channelID,
    );
    if (!present) {
      await this.redis.lpush(
        `${this.BOTKEY}.user.${user.id}.channellist`,
        channelID,
      );
    }
    await this.persistChannel(channel);
  }

  async getChannelsForUser(user: User): Promise<Channel[]> {
    const channelIds = await this.redis.lrange(
      `${this.BOTKEY}.user.${user.id}.channellist`,
      0,
      100,
    );
    const channels: Channel[] = [];
    for (const channelId of channelIds) {
      const channel = await this.getChannel(channelId);
      channels.push(channel);
    }
    return channels;
  }

  async getChannel(channelId: string): Promise<Channel> {
    const channelData = await this.redis.hgetall(
      `${this.BOTKEY}.channel.${channelId}`,
    );
    const channel = new Channel(channelId, channelData.name);
    channel.messageCount = parseInt(channelData.messagecount, 10) || 0;
    const targetList = await this.redis.lrange(
      `${this.BOTKEY}.channeltarget.${channelId}`,
      0,
      100,
    );
    for (const target of targetList) {
      channel.addTarget(target);
    }
    return channel;
  }

  async setWaitFor(chatId: string, waitFor: string): Promise<void> {
    await this.redis.set(`${this.BOTKEY}.chat.${chatId}.waitfor`, waitFor);
  }

  async deleteChannel(user: User, channel: Channel): Promise<void> {
    await this.redis.lrem(
      `${this.BOTKEY}.user.${user.id}.channellist`,
      0,
      channel.id,
    );
    await this.redis.del(`${this.BOTKEY}.channel.${channel.id}`);
    await this.redis.del(`${this.BOTKEY}.channeltarget.${channel.id}`);
  }

  async increaseMessageCount(): Promise<void> {
    await this.redis.incr(`${this.BOTKEY}.common.messagecount`);
  }

  async getMessageCount(): Promise<string> {
    return (await this.redis.get(`${this.BOTKEY}.common.messagecount`)) || "0";
  }
}
