const Apify = require('apify');

const { Actor, log } = Apify;

const parseJobs = async ({ request, $ }) => {
    const { item } = request.userData;
    const jsonCompanyInfo = Array.from($('script[type="application/ld+json"]')).map((x) => JSON.parse($(x).html())).pop();

    if (!jsonCompanyInfo) {
        throw new Error(`BLOCKED ${request.url}`);
    }

    // do not remap, so actor output will follow website format "as is"
    const moreDetails = {
        ...jsonCompanyInfo,
        '@context': undefined,
        '@type': undefined,
    };

    log.info(`Saving details for job with ID: ${item.id}`);
    // SAVING FINAL DATA
    await Actor.pushData({
        ...item,
        ...moreDetails,
    });
};

module.exports = {
    parseJobs,
};
