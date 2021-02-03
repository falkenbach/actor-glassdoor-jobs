const Apify = require('apify');
const cheerio = require('cheerio');
const Entities = require('html-entities').AllHtmlEntities;

const { log } = Apify.utils;
const { BASE_URL, REQUEST_HEADERS } = require('./consts');

const parseJobs = async (searchResults, proxyUrl) => {
    // encoding-decoding html entities
    // used to get jobDetails from JSON-LD instead of page content
    const entities = new Entities();

    // global variable for loaded cheerio content to keep jQuery-alike syntax
    let $;

    let rawdata;
    let json;

    const requestList = await Apify.openRequestList(
        'LIST3',
        searchResults.map((x) => ({ url: x.url, uniqueKey: x.id.toString() })),
    );
    await requestList.initialize();

    // keep parsed details from company overview to avoid extra calls
    const companyDetails = {};

    const crawler = new Apify.BasicCrawler({
        requestList,
        handleRequestFunction: async ({ request }) => {
            log.info(`job GET ${request.url}`);
            const rq = await Apify.utils.requestAsBrowser({
                url: request.url,
                proxyUrl,
                ...REQUEST_HEADERS,
            });
            $ = cheerio.load(rq.body);
            rawdata = $('script[type="application/ld+json"]').html();
            const cleanstr = rawdata.replace(/\s+/g, ' ').trim();
            json = JSON.parse(cleanstr);
            const updatedItem = searchResults.find((x) => x.id === parseInt(request.uniqueKey, 10));
            if (!updatedItem) {
                log.error(`Not found job listing id ${request.uniqueKey} in search results`);
                return;
            }

            // remove html formatting from job description
            // for whatever reason div below sometimes available, sometimes not
            let clearDetails = $('#JobDescriptionContainer').text().trim(); // but no artifacts from html decoding here
            if (!clearDetails) {
                // so for now second option will be used as jobDetails, decoding below was for json.description
                clearDetails = json.description; // html encoded, decoding is not 99% accurate
                try {
                    clearDetails = entities.decode(clearDetails); // this will transform html decoded content to plain html
                    clearDetails = $(clearDetails).text(); // then we create html from content and getting it as plain text
                } catch (err) {
                    log.error(err);
                }
            }
            // get employer id, check if we have cached overview
            const eid = $('#EmpHero').data('employer-id');
            let moreDetails = companyDetails[eid];
            if (!moreDetails) {
                moreDetails = {};
                // get company details from company overview page
                const companyUrl = new URL($('div.logo.cell a').attr('href'), BASE_URL);
                log.info(`company overview GET ${companyUrl}`);
                const rq2 = await httpRequest({
                    url: companyUrl,
                    ...headers,
                });
                $ = cheerio.load(rq2.body);
                $('div.infoEntity', '#EmpBasicInfo').each((i, el) => {
                    const infoKey = $('label', el).text().trim();
                    const info = $('span', el).text().trim();
                    if (infoKey && info) {
                        moreDetails[infoKey] = info;
                    }
                });
                companyDetails[eid] = moreDetails;
            }

            log.info(`Saving details for job listing id ${request.uniqueKey}`);
            // unified output based on list item and sub page
            await Apify.pushData({
                ...updatedItem,
                url: json.url,
                salary: json.estimatedSalary,
                jobLocation: json.jobLocation,
                companyDetails: { ...json.hiringOrganization, ...moreDetails },
                jobDetails: clearDetails,
                datePosted: json.datePosted,
            });
        },
        /*
        handleFailedRequestFunction: async ({ request }) => {
            await Apify.pushData({
                '#isFailed': true,
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
        */
    });
    await crawler.run();
    return searchResults;
};

module.exports = {
    parseJobs,
};
