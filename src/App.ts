import {KonvBot} from "./KonvBot";
import {DataService} from "./DataService";
import {ChatDAO} from "./ChatDao";
import eventBus from "./EventBus";

function main() {

	const botKey = '5333958735:AAHQ7LMmKvSbtWG4a0hkGbj_kDNBUid3_j0';
	const botName = 'KonvBot';
	const dataService = new DataService(new ChatDAO(""));
	const konvBot = new KonvBot(eventBus, botKey, botName, dataService);
}

main();
