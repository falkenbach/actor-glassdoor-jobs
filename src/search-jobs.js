const Apify = require('apify');
const cheerio = require('cheerio');

const { log } = Apify.utils;
const { BASE_URL, REQUEST_HEADERS } = require('./consts');

const searchJobs = async (query, location, maxResults, proxyUrl) => {
    const searchEndpoint = '/Job/jobs.htm';

    // global variable for loaded cheerio content to keep jQuery-alike syntax
    let $;

    // mapping for items in the jobs search list
    const mapJobListItem = (i, el) => {
        const employerRating = parseFloat($($($(el).find('div')[0]).find('span')[1]).text());
        return {
            id: $(el).data('id'),
            employerName: $($('a.jobLink > span', el)[1]).text(),
            employerRating: employerRating ? employerRating : '',
            jobTitle: $('a', el).last().text(),
            jobLocation: $(el).data('jobLoc'), 
            url: BASE_URL + $('a', el).attr('href'),
            jobDetails: '',
            companyDetails: '',
            salary: $(el).find('span[data-test="detailSalary"]').text().trim(),
             
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

    let itemsToSave;
    do {
        const searchUrl = new URL(nextPageUrl, BASE_URL);
        try {
            log.info(`GET ${searchUrl}`);
            const rq = await Apify.utils.requestAsBrowser({
                url: searchUrl.href,
                proxyUrl,
                ...REQUEST_HEADERS,
            });
            await Apify.setValue('HTML', rq.body, { contentType: 'text/html' });
            $ = cheerio.load(rq.body);
            if (maximumResults < 0) {
                const cntStr = $('p[data-test="jobsCount"]').text().replace(',', '');
                maximumResults = parseInt(cntStr, 10);
                if (!(maximumResults > 0)) {
                    throw new Error(`Failed to parse jobsCount from ${cntStr}`);
                }
                log.info(`Parsed maximumResults = ${maximumResults}`);
            }
            rawdata = $('li.react-job-listing');
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
        console.dir(json);
        itemsToSave = json.slice(0, maximumResults - savedItems);
        searchResults.push(...itemsToSave);
        savedItems += itemsToSave.length;
        nextPageUrl = $('a[data-test="pagination-next"]', '#FooterPageNav').attr('href');
        log.info(`Page ${page}: Found ${itemsToSave.length} items, next page: ${nextPageUrl}`);
        page++;
    } while (nextPageUrl && savedItems < maximumResults && itemsToSave && itemsToSave.length > 0);

    return searchResults;
};

module.exports = {
    searchJobs,
};
