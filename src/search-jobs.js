const Apify = require('apify');

const { log } = Apify;

const { BASE_URL,
} = require('./consts');

const mapJobListItem = ({ jobview }) => {
    const { header, job } = jobview;
    return {
        id: job.listingId,
        employerName: header.employerNameFromSearch,
        employerRating: header.rating,
        jobTitle: job.jobTitleText,
        jobLocation: header.locationName,
        url: BASE_URL + header.jobLink,
        ...header,
        __typename: undefined,
        employer: undefined,
        savedJobId: undefined,
    };
};

const searchJobs = async ({ request, $, crawler }, { maxResults }) => {
    const { page = 1, itemsCounter = 0 } = request.userData;

    let json = Array.from($('script[type="application/json"]')).map((x) => JSON.parse($(x).html()))
        .map((x) => x?.props?.pageProps?.apolloCache.ROOT_QUERY).filter(Boolean)
        .pop();
    if (!json) {
        log.info('BLOCKED');
    }
    // eslint-disable-next-line dot-notation
    json = Object.values(json).find((x) => x?.['__typename'] === 'JobListingSearchResults');

    const availableResults = json.jobListings.length * json.paginationCursors.length;
    log.info(`Available up to ${availableResults} results out of ${json.totalJobsCount} search items`);

    let items = json.jobListings?.map(mapJobListItem);
    const counter = itemsCounter + items.length;
    items = items.slice(0, maxResults && counter > maxResults ? maxResults - itemsCounter : undefined);

    await crawler.addRequests(items.map((x) => {
        return {
            url: x.url,
            userData: {
                label: 'PARSE-DETAILS',
                item: x,
            },
        };
    }), { forefront: false });

    const nextPage = json.paginationCursors?.find((x) => x.pageNumber === page + 1);
    if (nextPage && items.length >= json.jobListings?.length) {
        /*
        await crawler.addRequest({
            url: nextPage,
            userData: {
                page: page + 1,
                label,
            },
        });
        */
    }
};

module.exports = {
    searchJobs,
};
