const fs = require("fs").promises;
const moment = require('moment');
const statsLite = require("stats-lite");

const config = require("./config");

const scores = {

	weight: {
		upvote: 1,
		num_comments: 2,
		scoreThreshold: 5
	},

	flairs: {
		request: {
			upvote: 0.1,
			num_comments: 0.5,
			scoreThreshold: 0.5
		},

		resource: {
			upvote: 1,
			num_comments: 0.5,
			scoreThreshold: 1.5
		},

		discussion: {
			upvote: 0.5,
			num_comments: 1,
			scoreThreshold: 3
		}
	}

}

const modifiers = {

	age: {
		minimum: 2, //days
		maximum: 3000
	},

	archived: {
		includeUnArchived: true
	},

	includeApproved: false, //include threads which need to be approved since they are above the threshold but were removed
	includeNoFlair: false, //include flairs which are 'null' or 'undefined'
	includeGlobal: true //if flair not in scores.flairs
}

const ignoreFliars = ['request', 'resource'];


async function filterScores() {

	let totalThreads = 0;
	let belowCount = 0;
	let results = new Set();

	let data = await fs.readFile(config.subredditDataFile, {
		encoding: "utf-8"
	});

	let threads = JSON.parse(data);

	await fs.truncate(config.scoreResultFile).catch(e => console.log);

	let parseData = await fs.readFile(config.scoreResultFile, {
		encoding: "utf-8"
	}).catch(() => {
		return false
	});
	if (parseData) {
		parseData = JSON.parse(parseData);
	} else {
		parseData = [];
	}

	for (let thread of threads) {

		totalThreads++;

		let upvotes = thread.ups;
		let num_comments = thread.num_comments;
		let flair = thread.link_flair_text;
		let score, belowThreshold = false,
			threshold;

		let now = moment();
		let threadAge = moment.unix(thread.created_utc);
		threadAge = now.diff(threadAge, 'days');

		if (flair in scores.flairs) {
			score = parseInt(upvotes) * scores.flairs[flair].upvote + parseInt(num_comments) * scores.flairs[flair].num_comments;

			if (score < scores.flairs[flair].scoreThreshold) belowThreshold = true;
			threshold = scores.flairs[flair].scoreThreshold;

		} else {
			score = parseInt(upvotes) * scores.weight.upvote + parseInt(num_comments) * scores.weight.num_comments;

			if (score < scores.weight.scoreThreshold) belowThreshold = true;
			threshold = scores.weight.scoreThreshold;
			//console.log("score is " + score + " threshold is " + scores.weight.scoreThreshold)
		}

		if (!belowThreshold && !thread.removed) continue; //if thread is NOT below threshold and thread has NOT been removed
		if (!modifiers.includeApproved && !belowThreshold && thread.removed) continue;
		if (thread.removed && belowThreshold) continue; //if thread has been removed already and IS below threshold
		if (!flair && !modifiers.includeNoFlair) continue;
		if (flair in scores.flairs == false && !modifiers.includeGlobal) continue;
		if (thread.author == "[deleted]" || thread.ban_note == 'spam') continue;
		if (ignoreFliars.indexOf(flair) > -1) continue; //flair has been ignored
		if (threadAge < modifiers.age.minimum || threadAge > modifiers.age.maximum) continue;
		if (!thread.archived && !modifiers.archived.includeUnArchived) continue //if thread is NOT archived and we don't set include to true

		let resultItem = {
			url: thread.url,
			permalink: thread.permalink,
			author: thread.author,
			id: thread.id,
			num_comments: num_comments,
			upvotes: upvotes,
			flair: flair,
			score: score,
			threshold: threshold,
			age_days: threadAge
		}

		if (thread.removed && !belowThreshold) {
			resultItem.action = 'approve';
		}

		belowCount++;

		parseData.push(resultItem);


	}

	await fs.appendFile(config.scoreResultFile, JSON.stringify(parseData, null, 4));
	console.log("total items", totalThreads);
	console.log("Total below threshold", belowCount);
	//	console.log("Flairtypes", flairTypes);

}

async function calculateStatistics(thread) {

	let totalThreads = 0,
		removedThreads = 0,
		spam = 0,
		ups = 0,
		upsArr = [];
	let stats = {};

	let allAvgComments = new Set();

	let data = await fs.readFile(config.subredditDataFile, {
		encoding: "utf-8"
	});

	let threads = JSON.parse(data);


	flairsArr = [];
	flairsRemArr = [];
	flairsObj = {};
	flairsRemObj = {};
	stats.flairs = {};
	flairsTotal = [];

	for (let thread of threads) {

		totalThreads++;
		ups += thread.ups;
		allAvgComments.add(thread.num_comments);
		upsArr.push(thread.ups);
		flairsArr.push(thread.link_flair_text);

		if (thread.removed) {
			flairsRemArr.push(thread.link_flair_text);
			removedThreads++;
		}
		if (thread.spam) spam++;

	}

	flairsArr.forEach(function(x) {
		flairsObj[x] = (flairsObj[x] || 0) + 1;
	});
	flairsRemArr.forEach(function(x) {
		flairsRemObj[x] = (flairsRemObj[x] || 0) + 1;
	});

	for (let flair in flairsObj) {
		let c = flairsObj[flair];
		let r = flairsRemObj[flair];
		stats.flairs[flair] = {};
		stats.flairs[flair].total = c;
		stats.flairs[flair].removed = r;
		stats.flairs[flair].removed_perc = r / c * 100;
	}

	stats.threads = {
		total: totalThreads,
		removed: removedThreads,
		removed_perc: removedThreads / totalThreads * 100,
		spam: spam,
		spam_perc: spam / totalThreads * 100
	}

	stats.upvotes = {
		sum: ups,
		mean: statsLite.mean(upsArr),
		mode: statsLite.mode(upsArr),
		max: Math.max(...upsArr),
		min: Math.min(...upsArr)
	}

	await fs.writeFile(config.statsFile, JSON.stringify(stats, null, 4));

}

async function boot() {
	await filterScores();
	calculateStatistics();
}

boot();