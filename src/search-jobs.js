const Apify = require('apify');
const cheerio = require('cheerio');

const { log } = Apify.utils;

const { BASE_URL,
} = require('./consts');

const searchJobs = async ({ request, session }, requestQueue, proxyConfiguration) => {
    // GETTING LABEL AND PAGE COUNTER FROM THE REQUEST FOR PAGINATION
    const { label, searchResults } = request.userData;
    let { page, itemsToSave, savedItems, maximumResults } = request.userData;
    let $;
    // FUNCTION TO MAP JOB ELEMS ON THE PAGE
    const mapJobListItem = (i, el) => {
        // const employerRating = parseFloat($($($(el).find('div')[0]).find('span')[1]).text());
        const employerRating = parseFloat($(el).find('div:eq(0) span:eq(1)').first().text());
        return {
            id: $(el).data('id'),
            employerName: $($('a.jobLink > span', el)[1]).text(),
            employerRating: employerRating || '',
            jobTitle: $('a', el).last().text(),
            jobLocation: $(el).data('jobLoc'),
            url: BASE_URL + $('a', el).attr('href'),
            jobDetails: '', // GETTING IT IN PARSE-JOB.JS
            companyDetails: '', // GETTING IT IN PARSE-JOB.JS
            salary: $(el).find('span[data-test="detailSalary"]').text().trim(),
        };
    };
    // CHECK FOR THE LAST PAGE
    let currentPage;
    let maxPage;

    if (savedItems === 0 || savedItems < maximumResults) {
        // REQUEST ITSELF
        const rq = await Apify.utils.requestAsBrowser({
            url: request.url,
            proxyUrl: proxyConfiguration.newUrl(session.id),
        });
        // ADDING CHEERIO
        $ = cheerio.load(rq.body);
        // IF THERE IS NO MAX RESULT IN THE INPUT => GETTING ALL AVAILABLE
        if (maximumResults < 0) {
            // COUNTER OF RESULTS ON THE PAGE
            const cntStr = $('p[data-test="jobsCount"]').text().replace(',', '');
            maximumResults = parseInt(cntStr, 10);
            if (!(maximumResults > 0)) {
                throw new Error(`Failed to parse jobsCount from ${cntStr}`);
            }
            log.info(`Parsed maximumResults = ${maximumResults}`);
        }
        const rawdata = $('li.react-job-listing');
        const json = rawdata
            .map(mapJobListItem)
            .get();
        itemsToSave = json.slice(0, maximumResults - savedItems);
        searchResults.push(...itemsToSave);
        savedItems += itemsToSave.length;

        let nextPage;
        const currentUrl = request.url;
        if (page === 1) {
            // FOR THE NEXT PAGES THERE IS DIFFERENT STRUCTURE OF THE URL - GETTING IT FROM META TAG ON THE PAGE
            nextPage = $('meta[property="og:url"]').attr('content');
            // PAGINATION IS REPRESENTED BY '_IP2,3,4,5...'
            nextPage = nextPage.replace('.htm', '_IP2.htm');
        } else if (page > 1) {
            nextPage = currentUrl.replace(currentUrl.match(/IP([0-9.]+)/)[1], `${page}.`);
        }
        // SECOND PAGE WAS ADDED ABOVE => ADDING THIRD ONE
        if (page === 1) {
            page += 2;
        } else {
            page += 1;
        }
        currentPage = +$('div[data-test="page-x-of-y"]').text().replace('Page', '').split('of')[0].trim();
    try {
        maxPage = +$('div[data-test="page-x-of-y"]').text().replace('Page', '').split('of')[1].trim();
    } catch (e) {
        log.debug('Error on getting last page.', { message: e.message, stack: e.stack });
        throw new Error('Failed to get number of the last page, will try again...');
    }
        if (currentPage <= maxPage) {
            await requestQueue.addRequest({
                url: nextPage,
                userData: {
                    page,
                    label,
                    itemsToSave,
                    savedItems,
                    searchResults,
                    maximumResults,
                },
            });
        }
    }
    // NEED TO CHECK FOR UNIQUE => SOMETIMES THERE ARE SAME JOB OFFERS IN THE LIST.
    // ONE JOB CAN BE REPRESENTED IN DIFFERENT LOCATIONS.
    if (savedItems >= maximumResults || currentPage === maxPage) {
        const checkUnique = [...new Set(searchResults.map((x) => x.id))];
        log.info(`Found ${checkUnique.length} unique job offers out of ${searchResults.length} in total. Adding to the queue URLs with the job offers.`);
        for (const item of searchResults) {
            await requestQueue.addRequest({
                url: item.url,
                uniqueKey: item.id.toString(),
                userData: {
                    label: 'PARSE-JOBS',
                    item: { ...item },
                },
            });
        }
    }
};

module.exports = {
    searchJobs,
};
