const Apify = require('apify');
const crawlee = require('crawlee');
const { findGlassdoorLocation } = require('./src/find-location');
const { searchJobs } = require('./src/search-jobs');
const { parseJobs } = require('./src/parse-jobs');
const { BASE_URL } = require('./src/consts');

const { Actor, log } = Apify;
const { CheerioCrawler } = crawlee;

Actor.main(async () => {
    log.info('INPUT Validation...');
    const input = await Actor.getInput();
    // INPUTS
    const {
        startUrl,
        proxy,
        query,
        location,
        locationstate,
        // 4 options available to search with: Jobs, Companies, Salaries, Interviews
        // only Jobs and Companies are used because other two do not fit data model.
        // THIS ACTOR HAS ONLY 'JOBS' MODE (DECIDED TO MAKE SEPARATE ACTOR FOR 'COMPANY' MODE IF NEEDED)
        // category = 'Jobs',
    } = input;
    const proxyConfiguration = await Actor.createProxyConfiguration(proxy);
    // CHECKS
    if (Actor.isAtHome() && !proxyConfiguration) {
        throw new Error('WRONG INPUT: This actor must use Apify proxy or custom proxies when running on Apify platform!');
    }
    if (query && typeof query !== 'string') {
        throw new Error('WRONG INPUT: must contain `query` field as string');
    }

    if (startUrl && query) {
        log.warning('You provided in input both "URL" and "query" fields. Only start URL will be used in actor.');
    }

    if (startUrl && !startUrl.includes('/Job/')) {
        throw new Error('WRONG INPUT: invalid URL to start with. URL should be "Search" page with the job offers on it \n(i.e. https://www.glassdoor.com/Job/front-end-engineer-jobs-SRCH_KO0,18.htm).');
    }

    const startUrls = [];

    // DEALING WITH LOCATION
    // location is optional, if specified we need to get available options from location search
    let foundLocation = '';
    if (location && !startUrl) {
        // foundLocation = await findGlassdoorLocation(location, locationstate, proxyConfiguration);
    }

    // FIRST PAGE WITH THE SEARCH RESULTS
    let searchUrl;
    if (startUrl) {
        searchUrl = startUrl;
    } else {
        searchUrl = new URL(`/Job/jobs.htm?sc.keyword=${query}${foundLocation}&srs=RECENT_SEARCHES`, BASE_URL);
    }

    startUrls.push({
        url: searchUrl.toString(),
        userData: {
            page: 1,
            label: 'SEARCH-JOBS',
        },
    });
    // CRAWLER
    const crawler = new CheerioCrawler({
        maxRequestRetries: 5,
        requestHandler: async (context) => {
            const { url, userData: { label } } = context.request;
            log.info('Page opened.', { label, url });
            // eslint-disable-next-line default-case
            switch (label) {
                case 'SEARCH-JOBS':
                    return searchJobs(context, input);
                case 'PARSE-JOBS':
                    return parseJobs(context);
            }
        },
    });

    await crawler.run(startUrls);
    log.info('Crawler finished');
});
