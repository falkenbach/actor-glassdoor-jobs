const Apify = require('apify');
const requestPromise = require('request-promise');

const { log } = Apify.utils;
const { BASE_URL } = require('./consts');

const searchJobs = async (query, location, maxResults, searchEndpoint, headers) => {
    // global variable for loaded cheerio content to keep jQuery-alike syntax
    let $;

    // mapping for items in the jobs search list
    const mapJobListItem = (i, el) => {
        return {
            id: $(el).data('id'),
            employerName: $('div.jobInfoItem.jobEmpolyerName', el).text(),
            employerRating: parseFloat($('span.compactStars', el).text()),
            jobTitle: $('a', el).last().text(),
            jobLocation: $('span.subtle.loc', el).text(), // div.jobInfoItem.empLoc includes tooltips like "hot" or "easy hire"
            url: BASE_URL + $('a', el).attr('href'),
            jobDetails: '',
            companyDetails: '',
            salary: $('span.salaryText', el).text().trim(),
        };
    };

    let page = 1;
    let savedItems = 0;
    let rawdata;
    let json;
    let limitRetries = 0;
    let nextPageUrl = `${searchEndpoint}?sc.keyword=${query}${location}&srs=RECENT_SEARCHES`;

    const searchResults = [];
    // if no limit for results, then parse it from the initial search
    let maximumResults = maxResults > 0 ? maxResults : -1;
    const searchUrl = new URL(nextPageUrl, BASE_URL);

    do {
        try {
            log.info(`GET ${searchUrl}`);
            $ = await requestPromise({
                uri: searchUrl,
                ...headers,
            });
            if (maximumResults < 0) {
                const cntStr = $('p.jobsCount').text().replace(',', '');
                maximumResults = parseInt(cntStr, 10);
                if (!(maximumResults > 0)) {
                    throw new Error(`Failed to parse jobsCount from ${cntStr}`);
                }
                log.info(`Parsed maximumResults = ${maximumResults}`);
            }
            rawdata = $('li.jl');
            json = rawdata
                .map(mapJobListItem)
                .get();
        } catch (error) {
            if (error.statusCode === 504 && limitRetries < 5) {
                log.info(' - Encountered rate limit, waiting 3 seconds');
                await Apify.utils.sleep(3000);
                limitRetries++;
                continue; // eslint-disable-line
            } else {
                // Rethrow non rate-limit errors or if we are stuck
                throw error;
            }
        }

        const itemsToSave = json.slice(0, maximumResults - savedItems);
        searchResults.push(...itemsToSave);
        savedItems += itemsToSave.length;
        nextPageUrl = $('li.next a', '#FooterPageNav').attr('href');
        log.info(`Page ${page}: Found ${itemsToSave.length} items, next page: ${nextPageUrl}`);
        page++;
    } while (nextPageUrl && savedItems < maximumResults);

    return searchResults;
};

module.exports = {
    searchJobs,
};
