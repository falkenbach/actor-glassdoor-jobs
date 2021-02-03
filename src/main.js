const Apify = require('apify');

const { log } = Apify.utils;

const { findGlassdoorLocation } = require('./find-location');
const { searchJobs } = require('./search-jobs');
const { searchCompanies } = require('./search-companies');
const { parseJobs } = require('./parse-jobs');

Apify.main(async () => {
    log.info('INPUT Validation');
    const input = await Apify.getInput();

    const {
        proxy,
        query,
        maxResults,
        location,
        locationstate,
        // 4 options available to search with: Jobs, Companies, Salaries, Interviews
        // only Jobs and Companies are used because other two do not fit data model
        category = 'Jobs',
    } = input;

    const proxyConfiguration = await Apify.createProxyConfiguration(proxy);

    if (Apify.isAtHome() && !proxyConfiguration) {
        throw 'WRONG INPUT: This actor must use Apify proxy or custom proxies when running on Apify platform!';
    }

    if (typeof query !== 'string') {
        throw 'WRONG INPUT: must contain `query` field as string';
    }

    const proxyUrl = proxyConfiguration ? proxyConfiguration.newUrl() : undefined;

    // location is optional, if specified we need to get available options from location search
    let foundLocation = '';
    if (location) {
        foundLocation = await findGlassdoorLocation(location, locationstate, proxyUrl);
    }
    /*
    * Get search results
    * then crawl subpages to get details
    */
    let searchResults = [];
    try {
        if (category === 'Companies') {
            searchResults = await searchCompanies(query, foundLocation, maxResults, proxyUrl);
        } else if (category === 'Jobs') {
            searchResults = await searchJobs(query, foundLocation, maxResults, proxyUrl);
        }
    } catch (err) {
        log.error(err);
    }

    // at this point we have links to jobs in searchResults
    // either from direct jobs search or from companies reviews then from jobs subsection in company page
    const checkUnique = [...new Set(searchResults.map((x) => x.id))];
    log.info(`Found ${checkUnique.length} unique listings out of ${searchResults.length} in total`);

    if (searchResults.length === 0) {
        log.error('No results from search!');
    } else {
        await parseJobs(searchResults, proxyUrl);
        log.info(`Parsed ${checkUnique.length} items in total`);
    }
});
