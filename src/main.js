const Apify = require('apify');
const requestPromise = require('request-promise');
const cheerio = require('cheerio');
const { URL } = require('url');

const { log } = Apify.utils;
const DOMAIN = 'https://www.glassdoor.com';

Apify.main(async () => {
    const input = await Apify.getInput();
    const proxy = Apify.getApifyProxyUrl();
    const options = {
        headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.01',
            'accept-encoding': 'gzip, deflate, sdch, br',
            'accept-language': 'en-GB,en-US;q=0.8,en;q=0.6',
            referer: 'https://www.glassdoor.com/',
            'upgrade-insecure-requests': '1',
            // eslint-disable-next-line max-len
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
        gzip: true,
        proxy
    };
    const optionsCheerio = {
        transform: (body) => {
            return cheerio.load(body);
        },
        ...options,
    };

    if (!input || !input.query) {
        throw new Error('INPUT must contain query');
    }
    // if no maxResults specified then parse this amount from first search page
    let maxResults = parseInt(input.maxResults, 10);
    if (!maxResults) {
        maxResults = -1;
    }

    if (typeof input.location === 'string') {
        // location is optional, if specified we need to get available options from location search
        // results limited to 1 since we will not use more than 1
        const locations = await requestPromise({
            uri: new URL(`/findPopularLocationAjax.htm?term=${input.location}&maxLocationsToReturn=1`, DOMAIN),
            json: true,
            ...options,
        });
        if (locations.length > 0) {
            // expected output format
            // [{"compoundId":"C1132348","countryName":"United States","id":"C1132348","label":"New York, NY (US)",
            // "locationId":1132348,"locationType":"C","longName":"New York, NY (US)","realId":1132348}]
            input.location = `&locT=${locations[0].locationType}&locId=${locations[0].locationId}&locKeyword=${input.location}`;
            log.info(`Found location ${input.location}`);
        } else {
            throw new Error(`No locations found for ${input.location}`);
        }
    } else {
        log.error(`Incorrect locations value ${input.location}`);
        input.location = '';
    }

    let $;

    /*
    4 options available to search with: Jobs, Companies, Salaries, Interviews
    only Jobs and Companies are used because other two do not fit data model
    */
    let search;
    if (input.category === 'Companies') {
        search = '/Reviews/company-reviews.htm';
    } else {
        search = '/Job/jobs.htm';
        input.category = 'Jobs';
    }

    let page = 1;
    let savedItems = 0;
    let rawdata;
    let json;
    let limitRetries = 0;
    let nextPageUrl = `${search}?sc.keyword=${input.query}${input.location}&srs=RECENT_SEARCHES`;

    const mapJobListItem = (i, el) => {
        return {
            id: $(el).data('id'),
            employerName: $('div.jobInfoItem.jobEmpolyerName', el).text(),
            rating: parseFloat($('span.compactStars', el).text()),
            title: $('a', el).last().text(),
            location: $('span.subtle.loc', el).text(), // div.jobInfoItem.empLoc includes tooltips like "hot" or "easy hire"
            url: $('a', el).attr('href'),
            jobDetails: '',
            companyDetails: '',
            salary: $('span.salaryText', el).text().trim(),
            benefits: '',
        };
    };

    /*
    * Request search results first
    * then crawl subpages to get details
    */
    const searchResults = [];
    // if no limit for results, then parse it from the initial search
    let maximumResults = maxResults > 0 ? maxResults : -1;
    do {
        try {
            const searchUrl = new URL(nextPageUrl, DOMAIN);
            log.info(`GET ${searchUrl}`);
            $ = await requestPromise({
                uri: searchUrl,
                ...optionsCheerio,
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
                log(' - Encountered rate limit, waiting 3 seconds');
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

    const checkUnique = [...new Set(searchResults.map(x => x.id))];
    log.info(`Found ${checkUnique.length} unique job listings out of ${searchResults.length} in total`);

    if (searchResults.length === 0) {
        throw new Error('No results from search!');
    }

    const subPages = searchResults.map(x => ({ url: DOMAIN + x.url, uniqueKey: x.id.toString() }));
    const requestList = new Apify.RequestList({
        sources: subPages,
    });
    await requestList.initialize();

    const crawler = new Apify.BasicCrawler({
        requestList,
        handleRequestFunction: async ({ request }) => {
            $ = await requestPromise({
                url: request.url,
                ...optionsCheerio,
            });
            rawdata = $('script[type="application/ld+json"]').html();
            const cleanstr = rawdata.replace(/\s+/g, ' ').trim();
            json = JSON.parse(cleanstr);
            const updatedItem = searchResults.find(x => x.id === parseInt(request.uniqueKey, 10));
            if (!updatedItem) {
                log.error(`Not found job listing id ${request.uniqueKey} in search results`);
                return;
            }
            log.info(`Saving details for job listing id ${request.uniqueKey}`);
            // unified output based on list item and sub page
            await Apify.pushData({
                ...updatedItem,
                url: json.url,
                salary: json.estimatedSalary,
                location: json.jobLocation,
                companyDetails: json.hiringOrganization,
                jobDetails: json.description,
            });
        },
        handleFailedRequestFunction: async ({ request }) => {
            await Apify.pushData({
                '#isFailed': true,
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
    });
    await crawler.run();

    log.info(`Parsed ${checkUnique.length} items in total`);
});
