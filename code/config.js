const config = {

	subreddit: "datasets",
	maxItemsPerRequest: 100,

	pushShiftDataFile: "../data/pushshiftData.json",
	redditFetchFile: "../data/threadsToCrawl.json",
	subredditDataFile: "../data/datasetsThreads.json",
	scoreResultFile: "../data/datasetScores.json",
	threadRemoveLogFile: "../data/datasetsRemovedThreads.json",
	statsFile: "../data/datasetStats.json",

	reddit: {
		userAgent: "",
		clientId: "",
		clientSecret: "",
		username: "",
		password: ""
	},

}

module.exports = config;