const Apify = require('apify');
const cheerio = require('cheerio');
const Entities = require('html-entities').AllHtmlEntities;

const { log } = Apify.utils;

const parseJobs = async ({ request }, proxyUrl) => {
    const { item } = request.userData;
    // encoding-decoding html entities
    // used to get jobDetails from JSON-LD instead of page content
    const entities = new Entities();
    const rq = await Apify.utils.requestAsBrowser({
        url: request.url,
        proxyUrl,
    });
    // GETTING JSON WITH THE NEEDED INFO
    const $ = cheerio.load(rq.body);
    // GETTING INFO FROM THE PAGE
    let clearDetails = $('#JobDescriptionContainer').text().trim(); // but no artifacts from html decoding here
    let script = $('#JobView script').html();
    script = script.replace('window.appCache=', '').slice(0, -1);
    const jsonCompanyInfo = JSON.parse(script);

    if (!clearDetails) {
        // so for now second option will be used as jobDetails, decoding below was for json.description
        clearDetails = jsonCompanyInfo.initialState.jlData.job.description; // html encoded, decoding is not 99% accurate
        try {
            clearDetails = entities.decode(clearDetails); // this will transform html decoded content to plain html
            clearDetails = $(clearDetails).text(); // then we create html from content and getting it as plain text
        } catch (err) {
            log.error(err);
        }
    }

    // ON A HUGE NUMBER OF SEARCH ITEMS JSON IS A BIT DIFFERENT. SO NEEDS TO MAKE ALL THIS CHECKS
    const moreDetails = {
        logo: jsonCompanyInfo.initialState.jlData.header.employer.squareLogoUrl
            ? jsonCompanyInfo.initialState.jlData.header.employer.squareLogoUrl : null,
        name: jsonCompanyInfo.initialState.jlData.header.employerNameFromSearch
            ? jsonCompanyInfo.initialState.jlData.header.employerNameFromSearch : null,
        ceoName: jsonCompanyInfo.initialState.jlData.overview.ceo
            ? jsonCompanyInfo.initialState.jlData.overview.ceo.name : null,
        headquarters: jsonCompanyInfo.initialState.jlData.overview.headquarters
            ? jsonCompanyInfo.initialState.jlData.overview.headquarters : null,
        industry: jsonCompanyInfo.initialState.jlData.overview.primaryIndustry
            ? jsonCompanyInfo.initialState.jlData.overview.primaryIndustry.industryName : null,
        sector: (jsonCompanyInfo.initialState.jlData.overview.primaryIndustry
            && jsonCompanyInfo.initialState.jlData.overview.primaryIndustry.sectorName)
            ? jsonCompanyInfo.initialState.jlData.overview.primaryIndustry.sectorName : null,
        // COMPANY RATINGS
        // IF COMPANY DOESN'T HAVE RATINGS, VALUE IN JSON HAS NEGATIVE NUMBER, SO NEEDS TO MAKE CHECK IF > 0
        companyRating: (jsonCompanyInfo.initialState.jlData.rating
            && jsonCompanyInfo.initialState.jlData.rating > 0)
            ? jsonCompanyInfo.initialState.jlData.rating.starRating : null,
        careerOpportunitiesRating: (jsonCompanyInfo.initialState.jlData.overview.ratings
            && jsonCompanyInfo.initialState.jlData.overview.ratings > 0)
            ? jsonCompanyInfo.initialState.jlData.overview.ratings.careerOpportunitiesRating : null,
        compensationAndBenefitsRating: (jsonCompanyInfo.initialState.jlData.overview.ratings
            && jsonCompanyInfo.initialState.jlData.overview.ratings > 0)
            ? jsonCompanyInfo.initialState.jlData.overview.ratings.compensationAndBenefitsRating : null,
        cultureAndValuesRating: (jsonCompanyInfo.initialState.jlData.overview.ratings
            && jsonCompanyInfo.initialState.jlData.overview.ratings > 0)
            ? jsonCompanyInfo.initialState.jlData.overview.ratings.cultureAndValuesRating : null,
        workLifeBalanceRating: (jsonCompanyInfo.initialState.jlData.overview.ratings
            && jsonCompanyInfo.initialState.jlData.overview.ratings > 0)
            ? jsonCompanyInfo.initialState.jlData.overview.ratings.workLifeBalanceRating : null,
        revenue: jsonCompanyInfo.initialState.jlData.overview.revenue
            ? jsonCompanyInfo.initialState.jlData.overview.revenue : null,
        size: jsonCompanyInfo.initialState.jlData.overview.size
            ? jsonCompanyInfo.initialState.jlData.overview.size : null,
        type: jsonCompanyInfo.initialState.jlData.overview.type
            ? jsonCompanyInfo.initialState.jlData.overview.type : null,
        website: jsonCompanyInfo.initialState.jlData.overview.website
            ? jsonCompanyInfo.initialState.jlData.overview.website : null,
        yearFounded: jsonCompanyInfo.initialState.jlData.overview.yearFounded
            ? jsonCompanyInfo.initialState.jlData.overview.yearFounded : null,
    };

    log.info(`Saving details for job listing id ${request.uniqueKey}`);
    // SAVING FINAL DATA
    await Apify.pushData({
        ...item,
        url: `https://www.glassdoor.com${jsonCompanyInfo.initialState.parsedRequest.url}`,
        salary: {
            min: (jsonCompanyInfo.initialState.jlData.header.payPercentile10 && jsonCompanyInfo.initialState.jlData.header.payPercentile10 > 0)
                ? jsonCompanyInfo.initialState.jlData.header.payPercentile10 : null,
            max: (jsonCompanyInfo.initialState.jlData.header.payPercentile90 && jsonCompanyInfo.initialState.jlData.header.payPercentile90 > 0)
                ? jsonCompanyInfo.initialState.jlData.header.payPercentile90 : null,
            payPeriod: jsonCompanyInfo.initialState.jlData.header.payPeriod,
            currency: jsonCompanyInfo.initialState.jlData.header.payCurrency,
            source: jsonCompanyInfo.initialState.jlData.header.salarySource,
        },
        jobLocation: jsonCompanyInfo.initialState.jlData.header.locationName,
        companyDetails: { ...moreDetails },
        jobDetails: clearDetails,
        datePosted: jsonCompanyInfo.initialState.jlData.header.posted,
    });
};

module.exports = {
    parseJobs,
};
