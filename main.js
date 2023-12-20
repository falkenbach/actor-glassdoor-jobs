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
        const slug = query.toLowerCase().split(' ').join('-');
        searchUrl = new URL(`/Job/${slug}-jobs-SRCH_KO0,13.htm`, BASE_URL);
    }

    const url = searchUrl.toString();
    startUrls.push({
        url,
        userData: {
            page: 1,
            label: url.startsWith('https://www.glassdoor.com/Job/') ? 'SEARCH-JOBS' : 'PARSE-DETAILS',
        },
    });
    // CRAWLER
    const crawler = new CheerioCrawler({
        maxRequestRetries: 5,
        requestHandler: async (context) => {
            const { userData: { label } } = context.request;
            log.info(`${label} opened: ${context.request.url}`, { label, url });
            // eslint-disable-next-line default-case
            switch (label) {
                case 'SEARCH-JOBS':
                    return searchJobs(context, input);
                case 'PARSE-DETAILS':
                    return parseJobs(context);
            }
        },
    });

    await crawler.run(startUrls);
    log.info('Crawler finished');
});
