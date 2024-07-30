import { EventEmitter2 } from "eventemitter2";

export class EventBus extends EventEmitter2 {
  constructor() {
    super({
      wildcard: true,
      delimiter: ".",
      newListener: false,
      maxListeners: 100,
      verboseMemoryLeak: true,
    });
  }
}

export default new EventBus();
