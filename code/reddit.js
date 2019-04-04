const fs = require("fs").promises;
const snoowrap = require('snoowrap');
const request = require("request-promise");
const config = require("./config");

const r = new snoowrap({
	userAgent: config.reddit.userAgent,
	clientId: config.reddit.clientId,
	clientSecret: config.reddit.clientSecret,
	username: config.reddit.username,
	password: config.reddit.password
});

async function getDataFromPushShift() {

	let size = 1;
	let url = "https://elastic.pushshift.io/rs/submissions/_search/?q=(subreddit:" + config.subreddit + ")&size=" + size;

	let data = await request(url);
	data = JSON.parse(data);

	let maxHits = data.hits.total;
	url = "https://elastic.pushshift.io/rs/submissions/_search/?q=(subreddit:" + config.subreddit + ")&size=" + maxHits;

	data = await request(url);
	data = JSON.parse(data);

	await fs.writeFile(config.pushShiftDataFile, JSON.stringify(data, null, 4));

}

async function loadPushShiftData() {
	let data = await fs.readFile(config.pushShiftDataFile, {
		encoding: "utf-8"
	});
	data = JSON.parse(data);
	return data;
}

async function loadThreadsToFetch() {
	let data = await fs.readFile(config.redditFetchFile, {
		encoding: "utf-8"
	});
	let threads = JSON.parse(data);
	let threadList = new Set();

	for (let thread of threads) {
		threadList.add(thread);
	}

	return threadList;
}

async function generateThreadFetchList(data) {

	console.log("Generating thread fetch list");

	let ids = [];

	for (let hit of data.hits.hits) {

		let id = hit._id;
		id = parseInt(id).toString(36);

		ids.push(id);

	}

	console.log("Writing fetch list to file");
	await fs.writeFile(config.redditFetchFile, JSON.stringify(ids, null, 4));

}

async function readData() {

	let i = 0;

	let data = await fs.readFile(config.subredditDataFile, {
		encoding: "utf-8"
	});
	threads = JSON.parse(data);

	for (let thread of threads) {
		i++;
	}
	console.log("total items", i);
}

async function getThreadsFromReddit(threadList) {

	if (!threadList.size > 0) return;

	let i = 0;
	let ids = "";
	console.log("Thread list size", threadList.size);
	threadList.forEach((key, value, set) => {
		if (i >= config.maxItemsPerRequest) return;
		ids += "t3_" + key + ",";
		set.delete(key);
		i++;
	});

	console.log("threads remaining", threadList.size);

	let listings = await r.oauthRequest({
		uri: '/api/info/?id=' + ids,
		method: 'get'
	});

	await saveDataFromReddit(listings);
	await getThreadsFromReddit(threadList);

}

async function saveDataFromReddit(listings) {

	let redditData = await fs.readFile(config.subredditDataFile, {
		encoding: "utf-8"
	}).catch(() => {
		return false
	});
	if (redditData) {
		redditData = JSON.parse(redditData);
	} else {
		redditData = [];
	}

	for (let listing of listings) {
		redditData.push(listing);
		console.log("Saving data for ID: " + listing.id);
	}

	await fs.writeFile(config.subredditDataFile, JSON.stringify(redditData, null, 4));

}

async function getFetchedThreads() {

	let data = await fs.readFile(config.subredditDataFile, {
		encoding: "utf-8"
	}).catch(() => {
		return false;
	});
	if (!data) return;

	let threads = JSON.parse(data);
	let threadList = new Set();

	for (let thread of threads) {
		threadList.add(thread.id);
	}

	return threadList;

}

async function start(id) {

	console.log("Starting...");

	let exists = await fs.access(config.pushShiftDataFile).then(() => {
		return true;
	}).catch(() => {
		return false;
	});
	let data;

	if (exists) {
		console.log("Pushshift data exists, skipping");
		data = await loadPushShiftData();
	} else {
		console.log("Fetching data from pushshift");
		await getDataFromPushShift();
		console.log("Loading data from pushshift");
		data = await loadPushShiftData();
	}

	exists = await fs.access(config.redditFetchFile).then(() => {
		return true;
	}).catch(() => {
		return false;
	});

	if (!exists) {
		console.log("Generating reddit fetch file");
		await generateThreadFetchList(data);
	}

	console.log("Loading threads to fetch");
	let threads = await loadThreadsToFetch();
	let fetchedThreads = await getFetchedThreads();
	let threadList = new Set();

	console.log("Checking already fetched threads");

	for (let thread of threads) {

		if (fetchedThreads != undefined && fetchedThreads.has(thread)) {
			continue;
		}

		threadList.add(thread);

	}

	await getThreadsFromReddit(threadList);

	console.log("All done :)");

}

function boot() {
	console.log("Booting script");
	start().catch(e => {
		console.log("ERROR", e);
		console.log("Restarting in 20 seconds");
		setTimeout(() => boot(), 20000);
	});
}

boot();
//readData();