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

    log.info(`Saving details: ${item?.id || request.url}`);
    // SAVING FINAL DATA
    await Actor.pushData(Array.isArray(jsonCompanyInfo) ? jsonCompanyInfo : {
        ...item,
        ...moreDetails,
    });
};

module.exports = {
    parseJobs,
};
