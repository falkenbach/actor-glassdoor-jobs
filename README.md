# Actor - Glassdoor jobs scraper

## Glassdoor jobs, salaries, companies and reviews scraper

Glassdoor crawler provides more data than Glassdoor API and publicly available. Official API only provides search for companies and only to partners, while this actor will provide you with full details about available jobs either from direct search for jobs or by parsing opened jobs positions from companies search. No login required so you can collect this data without exposing your Glassdoor account.

Salary information parsed as "[estimated by Glassdoor](https://help.glassdoor.com/article/What-are-Salary-Estimates-in-Job-Listings/en_US/)" - if there is no estimation then there will be no data about salary. Estimated salary is data object like this:
```json
{
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": {
        "@type": "QuantitativeValue",
        "minValue": "100175",
        "maxValue": "130992",
        "unitText": "YEAR"
    }
}

```

In case if company reviews searched then parsing done in two steps - actor getting search results which is the list of companies, then for each company we getting jobs posted. So jobs from company can be from zero to dozens.

## Input parameters

The input of this scraper should be JSON containing the list of pages on Instagram that should be visited. Required fields are:

| Field | Type | Description |
| ----- | ---- | ----------- |
| query | String | Query to search for Glassdoor jobs or companies. |
| category | String | Jobs or Companies, any other value will be reset to Jobs. Glassdor also provides Salaries and Interviews but this results can not be logically mapped to Jobs, so not supported by actor. |
| location | String | (optional) Location search based on suggestions from Glassdoor and first match from the list will be used for actual search. If there is no match then actor will fail with error. |
| maxResults | Integer | (optional) How many items should be loaded from search results, if not specified then actor will try to parse all search results available. |

### Glassdoor jobs scraper Input example
```json
{
    "query": "Project manager",
    "category": "Jobs",
    "location": "New Yourk",
    "maxResults": 50
}

```

## During the run

During the run, the actor will output parsed URLs and status messages. Since no login required you can check parsed pages in more details if you want by opening them directly in browser. This might be helpful in particular if you not have or not want to use web login: not logged web users redirected to signup form by Glassdor after two-three navigations between pages. As alternative you can browse pages by direct URLs in [incognito browser mode](https://support.google.com/chrome/answer/95464?co=GENIE.Platform%3DDesktop&hl=en).

## Scraped Glassdoor jobs
The structure of each job item in output looks like below, please note that jobDetails can be a really long string, because its parsed from the entire page section. This is also the reason why formatting for it might be not 100% accurate. Id is job listing Id as in Glassdoor and expected to be unique.

```json
{
  "id": 3372440104,
  "employerName": "Valeo",
  "employerRating": null,
  "jobTitle": "PROJECT TECHNICAL MANAGER",
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Prague",
      "addressRegion": "52",
      "addressCountry": {
        "@type": "Country",
        "name": "CZ"
      }
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "50.0833",
      "longitude": "14.4667"
    }
  },
  "url": "https://www.glassdoor.com/job-listing/product-manager-pipedrive-JV_IC2296178_KO0,15_KE16,25.htm?jl=3381569011",
  "jobDetails": "Ready to tackle the challenges of the vehicle of the future? Join Valeo and revolutionize the comfort and well-being of all passengers! We are looking for an experienced TECHNICAL PROJECT MANAGER, who will be managing work of R&D project contributors and be responsible for detailed scheduling and budgeting.YOU GET THE OPPORTUNITY OF*Leads the project development phase from concept definition/RFQ till customer validation.*Secure Valeo development process and rules*Perform change management if required*Is responsible for the development of the complete product*Coordinates R&D team (e.g Mechanical leader, Electronic leader, Mechanical leader, Validation leader)*Answering technical part of RFQs *Analysis of customer requirements*Leads technically and supports the industrialization (design for manufacturing)*Represents R&D team toward project management, organization, and customer*Develop and control R&D project budget*Report R&D project status to Project Manager and Steering committee*Secure quality and process of product development*To plan R&D activities and make sure the right resources are assigned by the métiers (people & means)*To perform risk identification and develop project risks mitigation plan*To analyse the impact of change requests (customer and internal) and follow their implementation*To manage product’s configuration and the delivery (product / documentation)*Perform Design and Technical Reviews IF YOU HAVE* Masters degree in technical area in one of the technical fields (electronics, software, automotive, electrical engineering, automatization, machinery, physics, mechatronics, industrialization)* At least 3 years of experience in projects as project team member/project manager* Excellent English communication skills for daily communication* Driving licence and willingness to travel to customer meetings in Europe* Results oriented person with leadership skills* Team player, assertive, open-minded, decision making personalityWE OFFER* Work in a stable international company (in a multinational team) on challenging projects with huge impact on whole automotive industry* Automotive environment with cutting-edge technologies* Cooperation with Valeo development sites worldwide* Possibility to see the whole development process in one place from an idea (customer requirement) to a product testing and manufacture* Personal development through Special Trainings and Language Courses* Competitive package of benefits including 6 weeks of vacation, flexible working hours and home office possibility, company canteen, meal and free time vouchers, additional financial bonuses dependent on the results of the team or company, easy access to work by Prague public transportation, company car park, fitness and outdoor playground etc.",
  "companyDetails": {
    "@type": "Organization",
    "name": "Pipedrive",
    "logo": "https://media.glassdoor.com/sqll/963206/pipedrive-squarelogo-1429226256313.png",
    "sameAs": "www.pipedrive.com",
    "Website": "www.valeo.com",
    "Headquarters": "Paris (France)",
    "Size": "10000+ employees",
    "Founded": "1923",
    "Type": "Company - Public (FR)",
    "Industry": "Transportation Equipment Manufacturing",
    "Revenue": "$10+ billion (USD) per year",
    "Competitors": "Robert Bosch, Visteon"
  },
  "datePosted": "2019-11-07"
}

```
