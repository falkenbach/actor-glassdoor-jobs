const BASE_URL = 'https://www.glassdoor.com';

// AS WE ARE USING LATEST VERSION OF SDK (WITH GOT-SCRAPING) WE DON'T NEED ANY HEADERS (NEED TO CHECK)
// const REQUEST_HEADERS = {
//     headers: {
//         accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.01',
//         'accept-encoding': 'gzip, deflate, sdch, br',
//         'accept-language': 'en-GB,en-US;q=0.8,en;q=0.6',
//         referer: 'https://www.glassdoor.com/',
//         'upgrade-insecure-requests': '1',
//         'user-agent':
// 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36',
//         'Cache-Control': 'no-cache',
//         Connection: 'keep-alive',
//     },
//     gzip: true,
// };

module.exports = {
    BASE_URL,
    // REQUEST_HEADERS,
};
