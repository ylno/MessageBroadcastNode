import { ChatDAO } from "./ChatDao";

export class DataService {
  private chatDao: ChatDAO;

  constructor(chatDao: ChatDAO) {
    this.chatDao = chatDao;
  }

  getChatDao(): ChatDAO {
    return this.chatDao;
  }

  increaseMessageCount(): void {
    this.chatDao.increaseMessageCount();
  }

  async getMessageCount(): Promise<string> {
    return this.chatDao.getMessageCount();
  }
}
