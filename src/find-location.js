const Apify = require('apify');

const { log } = Apify.utils;
const { REQUEST_HEADERS } = require('./consts');

const findGlassdoorLocation = async (locationText, locationState, proxyUrl) => {
    // results limited to 1 since we will not use more than 1
    const locationsRequest = await Apify.utils.requestAsBrowser({
        url: `https://www.glassdoor.com/findPopularLocationAjax.htm?term=${locationText}&maxLocationsToReturn=10`,
        json: true,
        ...REQUEST_HEADERS,
        proxyUrl,
    });
    const locations = locationsRequest.body;
    if (locations.length > 0) {
        // expected output format
        // [{"compoundId":"C1132348","countryName":"United States","id":"C1132348","label":"New York, NY (US)",
        // "locationId":1132348,"locationType":"C","longName":"New York, NY (US)","realId":1132348}]
        let locIndex = -1;
        // there is no separate value for state, instead state is the part of longName i.e.
        // "Yorktown, VA (US)"
        if (locationState && typeof locationState === 'string') {
            locationState = locationState.toUpperCase();
            locIndex = locations.findIndex((x) => x.longName.includes(`, ${locationState} (`));
        }
        const foundLocation = locations[locIndex >= 0 ? locIndex : 0];
        locationText = `&locT=${foundLocation.locationType}&locId=${foundLocation.locationId}&locKeyword=${locationText}`;
    } else {
        throw new Error(`No locations found for ${locationText}`);
    }

    log.info(`Found location: ${locationText}`);
    return locationText;
};

module.exports = {
    findGlassdoorLocation,
};
