const Apify = require('apify');
const requestPromise = require('request-promise');

const { log } = Apify.utils;
const { BASE_URL } = require('./consts');

const searchCompanies = async (query, location, maxResults, searchEndpoint, headers) => {
    // global variable for loaded cheerio content to keep jQuery-alike syntax
    let $;

    // mapping for items in the companies reviews list
    const mapReviewListItem = (i, el) => {
        // original urls like /Overview/Working-at-Web-com-EI_IE12965.11,18.htm
        // should be changed to company jobs urls like /Jobs/Web-com-Jobs-E12965.htm
        const url1 = $('div.margBotXs a', el).attr('href');
        let url2 = url1.replace('Overview/Working-at-', 'Jobs/');
        const indA = url2.indexOf('-EI_IE');
        const indB = url2.indexOf('.', indA);
        url2 = url2.substr(0, indB);
        url2 = `${url2.replace('-EI_IE', '-Jobs-E')}.htm`;
        return {
            id: $(el).data('emp-id'),
            employerName: $('div.margBotXs a', el).text().trim(),
            employerRating: parseFloat($('span.bigRating.strong.margRtSm.h1', el).text()),
            url: url2,
        };
    };

    let page = 1;
    let savedItems = 0;
    let rawdata;
    let json;
    let limitRetries = 0;
    let nextPageUrl = `${searchEndpoint}?sc.keyword=${query}${location}&srs=RECENT_SEARCHES`;

    const reviewResults = [];
    let searchResults = [];
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
                const cntStr = $('strong', 'div.count.margBot.floatLt.tightBot').last().text().replace(',', '');
                maximumResults = parseInt(cntStr, 10);
                if (!(maximumResults > 0)) {
                    throw new Error(`Failed to parse companies count from ${cntStr}`);
                }
                log.info(`Parsed maximumResults = ${maximumResults}`);
            }
            rawdata = $('div.eiHdrModule');
            json = rawdata
                .map(mapReviewListItem)
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
        reviewResults.push(...itemsToSave);
        savedItems += itemsToSave.length;
        nextPageUrl = $('li.next a', '#FooterPageNav').attr('href');
        log.info(`Page ${page}: Found ${itemsToSave.length} items, next page: ${nextPageUrl}`);
        page++;
    } while (nextPageUrl && savedItems < maximumResults);

    if (reviewResults.length === 0) {
        return [];
    }

    // crawl company reviews to get jobs
    // phase 1 - getting jobs from Jobs tab of company pages
    // save job listing id and url in searchResults
    // excpected patter for produced urls is
    // eslint-disable-next-line max-len
    // /partner/jobListing.htm?pos=101&ao=192357&s=21&guid=0000016e49ba886daefd02a1638a7892&src=GD_JOB_AD&ei=868966&t=ESR&extid=2&exst=E&ist=L&ast=EL&vt=w&slr=true&cs=1_6b5d487e&cb=1573194992086&jobListingId=3026368183&rdserp=true
    const requestList = new Apify.RequestList({
        sources: reviewResults.map(x => ({ url: x.url, uniqueKey: x.id.toString() })),
    });
    await requestList.initialize();
    const crawlerJobs1 = new Apify.BasicCrawler({
        requestList,
        handleRequestFunction: async ({ request }) => {
            $ = await requestPromise({
                url: new URL(request.url, BASE_URL),
                ...headers,
            });
            const updatedItem = reviewResults.find(x => x.id === parseInt(request.uniqueKey, 10));
            if (!updatedItem) {
                log.error(`- not found review listing id ${request.uniqueKey} in search results`);
                return;
            }
            const jobList = $('div.JobsListItemStyles__jobDetailsContainer').get();
            log.info(`Preparing ${jobList.length} job(s) for company ${request.url}`);
            for (const el of jobList) {
                const jobLink = $('.JobDetailsStyles__jobTitle', el);
                if (!jobLink) {
                    log.error('- no job link element');
                    break;
                }
                const jobText = jobLink.text(); // $('.JobDetailsStyles__iconLink', el).text();
                const jobRef = jobLink.attr('href');
                let jobId = jobRef.match(/jobListingId=([^&]+)/);
                if (!jobRef || !jobId) {
                    log.error(`- job link ${jobRef} corrupted: ${jobLink.parent().html()}`);
                    break;
                }
                jobId = parseInt(jobId[1], 10);
                const jobResult = {
                    ...updatedItem,
                    id: jobId,
                    url: jobRef,
                    jobTitle: jobText,
                };
                searchResults.push(jobResult);
            }
        },
    });
    await crawlerJobs1.run();

    if (searchResults.length === 0) {
        return [];
    }

    log.info(`Found ${searchResults.length} jobs in ${reviewResults.length} company reviews`);
    // phase 2 - reparse searchResults to get direct link to job listing so from link to table view like this:
    // eslint-disable-next-line max-len
    // /partner/jobListing.htm?pos=101&ao=192357&s=21&guid=0000016e49ba886daefd02a1638a7892&src=GD_JOB_AD&ei=868966&t=ESR&extid=2&exst=E&ist=L&ast=EL&vt=w&slr=true&cs=1_6b5d487e&cb=1573194992086&jobListingId=3026368183&rdserp=true
    // we getting direct link like this:
    // eslint-disable-next-line max-len
    // /partner/jobListing.htm?pos=101&ao=192357&s=21&guid=0000016e49ba886daefd02a1638a7892&src=GD_JOB_AD&t=SR&extid=1&exst=OL&ist=&ast=OL&vt=w&slr=true&cs=1_6b5d487e&cb=1573195025827&jobListingId=3026368183
    // and saving it in searchResults
    // TODO - patterns have similarity, might be possible to craft second link from first without doing actual call to the server
    const requestList2 = new Apify.RequestList({
        sources: searchResults.map(x => ({ url: BASE_URL + x.url, uniqueKey: x.id.toString() })),
    });
    await requestList2.initialize();
    const crawlerJobs2 = new Apify.BasicCrawler({
        requestList: requestList2,
        handleRequestFunction: async ({ request }) => {
            $ = await requestPromise({
                url: request.url,
                ...headers,
            });
            // at this point we have from server jobs list page with original job selected
            const updatedItem = searchResults.find(x => x.id === parseInt(request.uniqueKey, 10));
            if (!updatedItem) {
                log.error(`- not found review listing id ${request.uniqueKey} in search results`);
                return;
            }
            let jobItem = $('li.jl.selected a').attr('href');
            if (!jobItem) {
                // this means only one item in the list, so its not "selected"
                jobItem = $('li.jl a').attr('href');
            }
            if (jobItem) {
                log.info(`Reparsed url ${updatedItem.url} to ${jobItem}`);
                updatedItem.url = BASE_URL + jobItem;
            } else {
                searchResults = searchResults.filter(x => x.id.toString() !== request.uniqueKey);
                log.error(`Job item ${request.uniqueKey} not found at ${request.url}`);
                await Apify.pushData({
                    '#isFailed': true,
                    '#debug': Apify.utils.createRequestDebugInfo(request),
                    '#html': $.html(),
                });
            }
        },
    });
    await crawlerJobs2.run();

    return searchResults;
};

module.exports = {
    searchCompanies,
};
