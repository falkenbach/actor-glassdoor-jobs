/* eslint-disable linebreak-style */
const Apify = require('apify');

const { log } = Apify.utils;

const findGlassdoorLocation = async (locationText, locationState, proxyConfiguration) => {
    // results limited to 1 since we will not use more than 1
    const locationsRequest = await Apify.utils.requestAsBrowser({
        url: `https://www.glassdoor.com/findPopularLocationAjax.htm?term=${locationText}&maxLocationsToReturn=10`,
        json: true,
        proxyUrl: proxyConfiguration.newUrl(),
    });
    const locations = locationsRequest.body;
    if (locations.length > 0) {
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
