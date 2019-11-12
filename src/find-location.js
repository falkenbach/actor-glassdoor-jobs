const Apify = require('apify');
const requestPromise = require('request-promise');

const { log } = Apify.utils;
const { BASE_URL, REQUEST_HEADERS } = require('./consts');

const findGlassdoorLocation = async (locationText, proxy) => {

    if (!locationText) {
        return '';
    }

    // results limited to 1 since we will not use more than 1
    const locations = await requestPromise({
        uri: new URL(`/findPopularLocationAjax.htm?term=${locationText}&maxLocationsToReturn=1`, BASE_URL),
        json: true,
        ...REQUEST_HEADERS,
        proxy,
    });
    if (locations.length > 0) {
        // expected output format
        // [{"compoundId":"C1132348","countryName":"United States","id":"C1132348","label":"New York, NY (US)",
        // "locationId":1132348,"locationType":"C","longName":"New York, NY (US)","realId":1132348}]
        locationText = `&locT=${locations[0].locationType}&locId=${locations[0].locationId}&locKeyword=${locationText}`;
    } else {
        throw new Error(`No locations found for ${locationText}`);
    }

    log.info(`Found location: ${locationText}`);
    return locationText;
};

module.exports = {
    findGlassdoorLocation,
};
