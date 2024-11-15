import { KonvBot } from "./KonvBot";
import { EventEmitter2 } from "eventemitter2";
import eventBus from "./EventBus";

describe("KonvBot", () => {
  test("Konvbot", () => {
    const konvBot = new KonvBot(eventBus, "", "", {} as any);
    const actual = konvBot.splitStringIntoParts("Letsencrypt begin restart Cert was renewed", 4096);
    console.log("actual", actual);
    expect(actual.length).toEqual(1);
  });

  test("Konvbot iterate messages", () => {
    const konvBot = new KonvBot(eventBus, "", "", {} as any);
    const messages = konvBot.splitStringIntoParts("Letsencrypt begin restart Cert was renewed", 4096);

    for (const part of messages) {
      console.log("part", part);
    }
  });
});
