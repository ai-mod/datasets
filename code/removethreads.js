const fs = require("fs").promises;
const snoowrap = require('snoowrap');
const request = require("request-promise");
const config = require("./config");

const r = new snoowrap({
	userAgent: config.reddit.userAgent
	clientId: config.reddit.clientId
	clientSecret: config.reddit.clientSecret,
	username: config.reddit.username,
	password: config.reddit.password
});

async function removeThread() {

	let data = await fs.readFile(config.scoreResultFile, {
		encoding: "utf-8"
	});

	let threads = JSON.parse(data);
	let i = 0;

	for (let thread of threads) {
		console.log("Removing thread: " + thread.id);
		console.log("URL: " + thread.url);
		await r.getSubmission(thread.id).remove();
		await addRemovedThreadToLogFile(thread);
		i++;
	}

}

async function addRemovedThreadToLogFile(thread) {

	let removedData = await fs.readFile(config.threadRemoveLogFile, {
		encoding: "utf-8"
	}).catch(() => {
		return false
	});
	if (removedData) {
		removedData = JSON.parse(removedData);
	} else {
		removedData = [];
	}

	thread.removed_epoch = Math.floor(new Date() / 1000);

	if (removedData.some(item => item.id === thread.id)) {
		console.log("ID already in removed data, skipping...");
		return;
	}

	removedData.push(thread);

	await fs.writeFile(config.threadRemoveLogFile, JSON.stringify(removedData, null, 4));
}

removeThread();