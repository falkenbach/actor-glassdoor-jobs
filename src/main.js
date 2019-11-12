const Apify = require('apify');
const cheerio = require('cheerio');

const { log } = Apify.utils;

const { REQUEST_HEADERS } = require('./consts');
const { findGlassdoorLocation } = require('./find-location');
const { searchJobs } = require('./search-jobs');
const { searchCompanies } = require('./search-companies');
const { parseJobs } = require('./parse-jobs');

Apify.main(async () => {
    const proxy = Apify.getApifyProxyUrl();

    log.info('INPUT Validation');
    const input = await Apify.getInput();
    if (!input || !input.query || typeof input.query !== 'string') {
        throw new Error('INPUT must contain query string');
    }
    // if no maxResults specified then parse this amount from first search page
    let { maxResults } = input;
    if (!maxResults) {
        maxResults = -1;
    } else if (typeof maxResults === 'string') {
        maxResults = parseInt(input.maxResults, 10);
    }
    // location is optional, if specified we need to get available options from location search
    if (input.location && typeof input.location === 'string') {
        input.location = await findGlassdoorLocation(input.location, proxy);
    }

    const headersCheerio = {
        transform: (body) => {
            return cheerio.load(body);
        },
        ...REQUEST_HEADERS,
        proxy,
    };

    /*
    4 options available to search with: Jobs, Companies, Salaries, Interviews
    only Jobs and Companies are used because other two do not fit data model
    */
    let searchEndpoint;
    if (input.category === 'Companies') {
        searchEndpoint = '/Reviews/company-reviews.htm';
    } else {
        searchEndpoint = '/Job/jobs.htm';
        input.category = 'Jobs';
    }

    /*
    * Get search results
    * then crawl subpages to get details
    */
    let searchResults = [];
    if (input.category === 'Companies') {
        searchResults = await searchCompanies(input.query, input.location, maxResults, searchEndpoint, headersCheerio);
    } else { // input.category === 'Jobs'
        searchResults = await searchJobs(input.query, input.location, maxResults, searchEndpoint, headersCheerio);
    }

    // at this point we have links to jobs in searchResults
    // either from direct jobs search or from companies reviews then from jobs subsection in company page
    const checkUnique = [...new Set(searchResults.map(x => x.id))];
    log.info(`Found ${checkUnique.length} unique listings out of ${searchResults.length} in total`);

    if (searchResults.length === 0) {
        log.error('No results from search!');
    } else {
        await parseJobs(searchResults, headersCheerio);
        log.info(`Parsed ${checkUnique.length} items in total`);
    }
});
