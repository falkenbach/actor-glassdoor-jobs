const Apify = require('apify');
const { findGlassdoorLocation } = require('./src/find-location');
const { searchJobs } = require('./src/search-jobs');
const { parseJobs } = require('./src/parse-jobs');
const { BASE_URL } = require('./src/consts');

const { log } = Apify.utils;

Apify.main(async () => {
    log.info('INPUT Validation...');
    const input = await Apify.getInput();
    // INPUTS
    const {
        proxy,
        query,
        maxResults,
        location,
        locationstate,
        // 4 options available to search with: Jobs, Companies, Salaries, Interviews
        // only Jobs and Companies are used because other two do not fit data model.
        // THIS ACTOR HAS ONLY 'JOBS' MODE (DECIDED TO MAKE SEPARATE ACTOR FOR 'COMPANY' MODE IF NEEDED)
        // category = 'Jobs',
    } = input;
    const proxyConfiguration = await Apify.createProxyConfiguration(proxy);
    // CHECKS
    if (Apify.isAtHome() && !proxyConfiguration) {
        throw new Error('WRONG INPUT: This actor must use Apify proxy or custom proxies when running on Apify platform!');
    }
    if (typeof query !== 'string') {
        throw new Error('WRONG INPUT: must contain `query` field as string');
    }

    const proxyUrl = proxyConfiguration ? proxyConfiguration.newUrl() : undefined;
    // DEALING WITH LOCATION
    // location is optional, if specified we need to get available options from location search
    let foundLocation = '';
    if (location) {
        foundLocation = await findGlassdoorLocation(location, locationstate, proxyUrl);
    }
    // if no limit for results, then parse it from the initial search
    const maximumResults = maxResults > 0 ? maxResults : -1;
    const requestQueue = await Apify.openRequestQueue();
    // FIRST PAGE WITH THE SEARCH RESULTS
    const searchUrl = new URL(`/Job/jobs.htm?sc.keyword=${query}${foundLocation}&srs=RECENT_SEARCHES`, BASE_URL);
    await requestQueue.addRequest({
        url: searchUrl.toString(),
        userData: {
            page: 1,
            label: 'SEARCH-JOBS',
            searchResults: [],
            itemsToSave: [],
            savedItems: 0,
            maximumResults,
        },
    });
    // CRAWLER
    const crawler = new Apify.BasicCrawler({
        requestQueue,
        maxConcurrency: 20,
        // SOMETIMES IT FAILS TO GET NEEDED JSON FROM THE PAGE => INCREASED RETRIES
        maxRequestRetries: 7,
        handleRequestFunction: async (context) => {
            const { url, userData: { label } } = context.request;
            log.info('Page opened.', { label, url });
            // eslint-disable-next-line default-case
            switch (label) {
                case 'SEARCH-JOBS':
                    return searchJobs(context, requestQueue, proxyUrl);
                case 'PARSE-JOBS':
                    return parseJobs(context, proxyUrl);
            }
        },
        handleFailedRequestFunction: async ({ request, error }) => {
            log.error(`Request ${request.url} failed repeatedly, running out of retries (Error: ${error.message})`);
        },
    });
    log.info('Starting crawler');
    await crawler.run();
    log.info('Crawler finished');
});
