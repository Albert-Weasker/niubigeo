# R02 · vercel.com

[简体中文](./README.zh-CN.md) · [All cases](../../README.md)

## Observed result

All described frontend deployment; three keyword answers failed analysis across three repeats.

Initial D: 3/3 analyzable current answers. Measurement D: 9/9 analyzable first answers. K: 6/9 analyzable first answers. These are answer-coverage counts, not recognition rates or product metric denominators.

Execution status: **partial**.

![vercel.com: individual domain recognition results](../../../assets/screenshots/v0.2.0-rc.1/R02-models.png)

R02 · vercel.com · D · 3 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:01:42.187Z to 2026-09-08T06:01:42.187Z. Original failures remain visible. Captured: 2026-09-08T07:18:49.519Z.

## Conditions

Input domain: vercel.com. Answer language: en.

Protocols: D = domain-recognition/v1; K = keyword-discovery/v1.

D receives the domain, language, fixed protocol and model settings. K receives a frozen neutral keyword. Browsing categories are not sent to models.

- openai/gpt-4o-mini · off
- google/gemini-2.5-flash-lite · off
- openai/gpt-4.1-mini · provider_native

## Model observations

### Google: Gemini 2.5 Flash Lite

**Observed at:** 2026-09-08T06:01:42.187Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: 3ea7fabd-ebb6-429e-a2c1-4b449f84774d · completed · executionMode: unverified.

Brand: Vercel

Business: Vercel is a cloud platform for frontend developers, providing a seamless experience for building, deploying, and scaling web applications. It offers a global edge network, serverless functions, and a developer-friendly workflow.

Original span: UTF-16 [188, 416) · [Full answer](#attempt-3ea7fabd-ebb6-429e-a2c1-4b449f84774d)

Category: Cloud platform, Frontend development, Web hosting, Serverless computing

Brand keywords: Frontend, Cloud, Deployment, Serverless, Web development

Competitors named by this model:

- Netlify · netlify.com: Netlify is a platform for building and deploying modern web projects. It offers a unified workflow for frontend developers, including hosting, CI/CD, serverless functions, and a global CDN.. Keywords: Jamstack, Serverless, Web hosting
- AWS Amplify · aws.amazon.com/amplify/: AWS Amplify is a set of tools and services that enables frontend and mobile developers to build scalable full-stack applications, powered by AWS.. Keywords: Cloud, Frontend, Backend
- Firebase · firebase.google.com: Firebase is a platform developed by Google for building web and mobile applications. It provides a suite of tools for app development, including hosting, databases, authentication, and analytics.. Keywords: App development, Hosting, Backend

Uncertain: —


<a id="attempt-3ea7fabd-ebb6-429e-a2c1-4b449f84774d"></a>

<details><summary>Read the original answer</summary>

<pre>{
  "domainRecognition": "recognized",
  "analysisStatus": "recognized",
  "recognizedBrand": {
    "value": "Vercel",
    "citationUrls": []
  },
  "businessDescription": {
    "value": "Vercel is a cloud platform for frontend developers, providing a seamless experience for building, deploying, and scaling web applications. It offers a global edge network, serverless functions, and a developer-friendly workflow.",
    "citationUrls": []
  },
  "productCategory": {
    "value": "Cloud platform, Frontend development, Web hosting, Serverless computing",
    "citationUrls": []
  },
  "competitors": [
    {
      "name": "Netlify",
      "domain": "netlify.com",
      "businessDescription": "Netlify is a platform for building and deploying modern web projects. It offers a unified workflow for frontend developers, including hosting, CI/CD, serverless functions, and a global CDN.",
      "productCategory": "Frontend development platform, Web hosting, Serverless computing",
      "keywords": [
        {
          "keyword": "Jamstack",
          "citationUrls": []
        },
        {
          "keyword": "Serverless",
          "citationUrls": []
        },
        {
          "keyword": "Web hosting",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "AWS Amplify",
      "domain": "aws.amazon.com/amplify/",
      "businessDescription": "AWS Amplify is a set of tools and services that enables frontend and mobile developers to build scalable full-stack applications, powered by AWS.",
      "productCategory": "Cloud platform, Frontend development, Mobile development",
      "keywords": [
        {
          "keyword": "Cloud",
          "citationUrls": []
        },
        {
          "keyword": "Frontend",
          "citationUrls": []
        },
        {
          "keyword": "Backend",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "Firebase",
      "domain": "firebase.google.com",
      "businessDescription": "Firebase is a platform developed by Google for building web and mobile applications. It provides a suite of tools for app development, including hosting, databases, authentication, and analytics.",
      "productCategory": "App development platform, Web hosting, Backend services",
      "keywords": [
        {
          "keyword": "App development",
          "citationUrls": []
        },
        {
          "keyword": "Hosting",
          "citationUrls": []
        },
        {
          "keyword": "Backend",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    }
  ],
  "brandKeywords": [
    {
      "keyword": "Frontend",
      "citationUrls": []
    },
    {
      "keyword": "Cloud",
      "citationUrls": []
    },
    {
      "keyword": "Deployment",
      "citationUrls": []
    },
    {
      "keyword": "Serverless",
      "citationUrls": []
    },
    {
      "keyword": "Web development",
      "citationUrls": []
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `1194b50f511a1e5adda57e5767fa0f5177b5e189597a4c136d234a300ca86974`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `1194b50f511a1e5adda57e5767fa0f5177b5e189597a4c136d234a300ca86974`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Vercel | Frontend | Frontend [500, 508) |
| Vercel | Cloud | Cloud [484, 489) |
| Vercel | Deployment | Deployment [2819, 2829) |
| Vercel | Serverless | Serverless [535, 545) |
| Vercel | Web development | Web development [2957, 2972) |
| Netlify | Jamstack | Jamstack [1034, 1042) |
| Netlify | Serverless | Serverless [535, 545) |
| Netlify | Web hosting | Web hosting [522, 533) |
| AWS Amplify | Cloud | Cloud [484, 489) |
| AWS Amplify | Frontend | Frontend [500, 508) |
| AWS Amplify | Backend | Backend [1852, 1859) |
| Firebase | App development | App development [2267, 2282) |
| Firebase | Hosting | Hosting [2467, 2474) |
| Firebase | Backend | Backend [1852, 1859) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### OpenAI: GPT-4.1 Mini

**Observed at:** 2026-09-08T06:01:42.187Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: 3f309cc7-3627-421b-a865-aa03a874d826 · completed · executionMode: native.

Brand: Vercel

Business: Vercel is a platform designed to enhance the web development experience by providing developers with the necessary frameworks, workflows, and infrastructure. It focuses on enabling the creation and deployment of high-performance web applications, emphasizing speed and personalization. Vercel supports various front-end frameworks and optimizes the deployment process, making it easier for developers to deliver seamless user experiences. The platform is particularly known for its integration with serverless functions and static site generation, catering to modern web development needs.

Original span: UTF-16 [151, 740) · [Full answer](#attempt-3f309cc7-3627-421b-a865-aa03a874d826)

Category: Web Development Platform

Brand keywords: Frontend Development

Competitors named by this model:

- Netlify · netlify.com: Netlify is a cloud platform that provides hosting and serverless backend services for web applications and static websites. It offers continuous deployment from Git repositories, a global content delivery network, and serverless functions, enabling developers to build and deploy modern web projects efficiently.. Keywords: Hosting

Uncertain: —


<a id="attempt-3f309cc7-3627-421b-a865-aa03a874d826"></a>

<details><summary>Read the original answer</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Vercel","citationUrls":[]},"businessDescription":{"value":"Vercel is a platform designed to enhance the web development experience by providing developers with the necessary frameworks, workflows, and infrastructure. It focuses on enabling the creation and deployment of high-performance web applications, emphasizing speed and personalization. Vercel supports various front-end frameworks and optimizes the deployment process, making it easier for developers to deliver seamless user experiences. The platform is particularly known for its integration with serverless functions and static site generation, catering to modern web development needs.","citationUrls":[]},"productCategory":{"value":"Web Development Platform","citationUrls":[]},"competitors":[{"name":"Netlify","domain":"netlify.com","businessDescription":"Netlify is a cloud platform that provides hosting and serverless backend services for web applications and static websites. It offers continuous deployment from Git repositories, a global content delivery network, and serverless functions, enabling developers to build and deploy modern web projects efficiently.","productCategory":"Web Development Platform","keywords":[{"keyword":"Hosting","citationUrls":[]}],"citationUrls":[]}],"brandKeywords":[{"keyword":"Frontend Development","citationUrls":[]}],"unknowns":[]}</pre>

</details>

SHA-256: `7d16ab080125d1611779730d88093e810fa8a2b595ea31851b74e1315327a021`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `7d16ab080125d1611779730d88093e810fa8a2b595ea31851b74e1315327a021`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Vercel | Frontend Development | Frontend Development [1374, 1394) |
| Netlify | Hosting | Hosting [1296, 1303) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### OpenAI: GPT-4o-mini

**Observed at:** 2026-09-08T06:01:42.187Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: 1d78e06f-2a7d-408b-a97c-1142e48434aa · completed · executionMode: unverified.

Brand: Vercel

Business: A platform for frontend developers to host websites and applications.

Original span: UTF-16 [151, 220) · [Full answer](#attempt-1d78e06f-2a7d-408b-a97c-1142e48434aa)

Category: Web Hosting and Deployment

Brand keywords: frontend development, serverless deployment

Competitors named by this model:

- Netlify · netlify.com: A platform for deploying and hosting static websites and applications.. Keywords: static site hosting, continuous deployment
- AWS Amplify · aws.amazon.com/amplify: A set of tools and services for building scalable mobile and web applications.. Keywords: cloud hosting, serverless architecture
- Firebase · firebase.google.com: A platform for building mobile and web applications, providing backend services.. Keywords: real-time database, app hosting

Uncertain: —


<a id="attempt-1d78e06f-2a7d-408b-a97c-1142e48434aa"></a>

<details><summary>Read the original answer</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Vercel","citationUrls":[]},"businessDescription":{"value":"A platform for frontend developers to host websites and applications.","citationUrls":[]},"productCategory":{"value":"Web Hosting and Deployment","citationUrls":[]},"competitors":[{"name":"Netlify","domain":"netlify.com","businessDescription":"A platform for deploying and hosting static websites and applications.","productCategory":"Web Hosting and Deployment","keywords":[{"keyword":"static site hosting","citationUrls":[]},{"keyword":"continuous deployment","citationUrls":[]}],"citationUrls":[]},{"name":"AWS Amplify","domain":"aws.amazon.com/amplify","businessDescription":"A set of tools and services for building scalable mobile and web applications.","productCategory":"Cloud Services","keywords":[{"keyword":"cloud hosting","citationUrls":[]},{"keyword":"serverless architecture","citationUrls":[]}],"citationUrls":[]},{"name":"Firebase","domain":"firebase.google.com","businessDescription":"A platform for building mobile and web applications, providing backend services.","productCategory":"Mobile and Web Development","keywords":[{"keyword":"real-time database","citationUrls":[]},{"keyword":"app hosting","citationUrls":[]}],"citationUrls":[]}],"brandKeywords":[{"keyword":"frontend development","citationUrls":[]},{"keyword":"serverless deployment","citationUrls":[]}],"unknowns":[]}</pre>

</details>

SHA-256: `85e8ee03818e2c8f80b11a090fd9db22508c2944e69080817400c2c027bcf14b`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `85e8ee03818e2c8f80b11a090fd9db22508c2944e69080817400c2c027bcf14b`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Vercel | frontend development | frontend development [1339, 1359) |
| Vercel | serverless deployment | serverless deployment [1392, 1413) |
| Netlify | static site hosting | static site hosting [538, 557) |
| Netlify | continuous deployment | continuous deployment [590, 611) |
| AWS Amplify | cloud hosting | cloud hosting [870, 883) |
| AWS Amplify | serverless architecture | serverless architecture [916, 939) |
| Firebase | real-time database | real-time database [1206, 1224) |
| Firebase | app hosting | app hosting [1257, 1268) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

## Neutral keyword tests

Frontend Development

K valid counts analyzable first-attempt answers only, not product metric denominators. Inspect archived metric samples, included flags and judgments. A later successful retry does not replace this coverage count.

Selection records, exact quotes and exclusions are in the evidence file. Each answer observes the target and other entities under the same conditions; offline and online differences are not model rankings.

### Frontend Development · google/gemini-2.5-flash-lite

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 07cb5c01-7756-4a97-a4fb-1d70a3792c2f · probeId: 5ff003cd-d6e9-4767-8737-4693ec3dd4d0

off · completed · firstAttemptId: be8d5234-f5fa-4880-a384-68edcd013f53

analysisStatus: completed · resultAttemptId: be8d5234-f5fa-4880-a384-68edcd013f53

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development · recommendation: — · attemptId: be8d5234-f5fa-4880-a384-68edcd013f53

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt be8d5234-f5fa-4880-a384-68edcd013f53

completed · Observed at: 2026-09-08T06:02:03.502Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-be8d5234-f5fa-4880-a384-68edcd013f53"></a>

<details><summary>Read the original answer</summary>

<pre>{
  "analysisStatus": "completed",
  "mentions": [
    {
      "name": "Frontend Development",
      "domain": null,
      "recommendation": "mentioned",
      "mentionQuote": "Frontend Development",
      "recommendationQuote": null,
      "firstMentionOffset": 0,
      "firstRecommendationOffset": null,
      "firstMentionState": "unique",
      "firstRecommendationState": "none"
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `c4419356320b9943bf6b7580f6253cd84c9e1ca49c2b67e49f09081d473adff9`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4o-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 07cb5c01-7756-4a97-a4fb-1d70a3792c2f · probeId: 1cdbbb79-48e4-4df2-b4a4-b0c5629f7e5b

off · completed · firstAttemptId: cbcb0beb-1a2f-4b3f-9c98-864e87d1a720

analysisStatus: completed · resultAttemptId: cbcb0beb-1a2f-4b3f-9c98-864e87d1a720

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development is a crucial aspect of web development. · recommendation: — · attemptId: cbcb0beb-1a2f-4b3f-9c98-864e87d1a720

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt cbcb0beb-1a2f-4b3f-9c98-864e87d1a720

completed · Observed at: 2026-09-08T06:02:00.163Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-cbcb0beb-1a2f-4b3f-9c98-864e87d1a720"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"Frontend Development","domain":null,"recommendation":"mentioned","mentionQuote":"Frontend Development is a crucial aspect of web development.","recommendationQuote":null,"firstMentionOffset":0,"firstRecommendationOffset":null,"firstMentionState":"unique","firstRecommendationState":"none"}],"unknowns":[]}</pre>

</details>

SHA-256: `21e4c2c4f3743ef36803acb9964536f91cd1975fd26c724cf3908994e032ea59`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4.1-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 07cb5c01-7756-4a97-a4fb-1d70a3792c2f · probeId: e981e3e9-555a-4ad9-9c9a-5300c07213e3

provider_native · failed · firstAttemptId: 027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3

analysisStatus: analysis_failed · resultAttemptId: 027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3

- mentionJudgment: unknown
- recommendationJudgment: unknown


Uncertain: Unterminated string in JSON at position 4387 (line 1 column 4388)

[Actual request and answer evidence](./public-evidence.json)

#### Attempt 027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3

analysis_failed · Observed at: 2026-09-08T06:01:57.968Z · First attempt

requestedSearch: provider_native · used: true · executionMode: native

OpenRouter metadata confirmed provider-native web search.

Error: analysis_failed · Unterminated string in JSON at position 4387 (line 1 column 4388)

finish_reason: stop

<a id="attempt-027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"React","domain":"reactjs.org","recommendation":"positive","mentionQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","recommendationQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Vue.js","domain":"vuejs.org","recommendation":"positive","mentionQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","recommendationQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Angular","domain":"angular.io","recommendation":"positive","mentionQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","recommendationQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Svelte","domain":"svelte.dev","recommendation":"positive","mentionQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles. Genuinely enjoyable to work with.\"","recommendationQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles. Genuinely enjoyable to work with.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Next.js","domain":"nextjs.org","recommendation":"positive","mentionQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","recommendationQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Tailwind CSS","domain":"tailwindcss.com","recommendation":"positive","mentionQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","recommendationQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"shadcn/ui","domain":"github.com/shadcn/ui","recommendation":"positive","mentionQuote":"\"shadcn/ui is beautifully-designed, accessible components and a code distribution platform.\"","recommendationQuote":"\"shadcn/ui is beautifully-designed, accessible components and a code distribution platform.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"MUI","domain":"mui.com","recommendation":"positive","mentionQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","recommendationQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Semantic UI React","domain":"react.semantic-ui.com","recommendation":"positive","mentionQuote":"\"Semantic UI React provides React components.\"","recommendationQuote":"\"Semantic UI React provides React components.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Chakra UI","domain":"chakra-ui.com","recommendation":"positive","mentionQuote":"\"Chakra UI is a component system for building products with speed.\"","recommendationQuote":"\"Chakra UI is a component system for building products with speed.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Bootstrap","domain":"getbootstrap.com","recommendation":"positive","mentionQuote":"\"Bootstrap is the most popular HTML, CSS, and JavaScript framework for developing responsive, mobile-first websites.\"","recommendation</pre>

</details>

SHA-256: `d76aec4fb046d6d9d3221380478b0472007723709fb929a1d8c3e0382f857c28`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4o-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 7fa563e8-49d8-4fc7-827d-8211be751850 · probeId: 0d96d8a7-bb6c-4e96-958e-6337e6fddf3e

off · completed · firstAttemptId: 12d47fd4-0e9b-459b-a27f-314da6c86ca6

analysisStatus: completed · resultAttemptId: 12d47fd4-0e9b-459b-a27f-314da6c86ca6

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development is a crucial aspect of web development. · recommendation: — · attemptId: 12d47fd4-0e9b-459b-a27f-314da6c86ca6

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt 12d47fd4-0e9b-459b-a27f-314da6c86ca6

completed · Observed at: 2026-09-08T06:02:18.414Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-12d47fd4-0e9b-459b-a27f-314da6c86ca6"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"Frontend Development","domain":null,"recommendation":"mentioned","mentionQuote":"Frontend Development is a crucial aspect of web development.","recommendationQuote":null,"firstMentionOffset":0,"firstRecommendationOffset":null,"firstMentionState":"unique","firstRecommendationState":"none"}],"unknowns":[]}</pre>

</details>

SHA-256: `21e4c2c4f3743ef36803acb9964536f91cd1975fd26c724cf3908994e032ea59`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4.1-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 7fa563e8-49d8-4fc7-827d-8211be751850 · probeId: 83eae328-7e7e-46e8-96a0-262b3f75e032

provider_native · failed · firstAttemptId: e847731b-ed41-455c-801a-03f4e75598ae

analysisStatus: analysis_failed · resultAttemptId: e847731b-ed41-455c-801a-03f4e75598ae

- mentionJudgment: unknown
- recommendationJudgment: unknown


Uncertain: Unterminated string in JSON at position 4384 (line 1 column 4385)

[Actual request and answer evidence](./public-evidence.json)

#### Attempt e847731b-ed41-455c-801a-03f4e75598ae

analysis_failed · Observed at: 2026-09-08T06:02:22.580Z · First attempt

requestedSearch: provider_native · used: true · executionMode: native

OpenRouter metadata confirmed provider-native web search.

Error: analysis_failed · Unterminated string in JSON at position 4384 (line 1 column 4385)

finish_reason: stop

<a id="attempt-e847731b-ed41-455c-801a-03f4e75598ae"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"React","domain":"reactjs.org","recommendation":"positive","mentionQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","recommendationQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Vue.js","domain":"vuejs.org","recommendation":"positive","mentionQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","recommendationQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Angular","domain":"angular.io","recommendation":"positive","mentionQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","recommendationQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Svelte","domain":"svelte.dev","recommendation":"positive","mentionQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles. Genuinely enjoyable to work with.\"","recommendationQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles. Genuinely enjoyable to work with.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Next.js","domain":"nextjs.org","recommendation":"positive","mentionQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","recommendationQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Tailwind CSS","domain":"tailwindcss.com","recommendation":"positive","mentionQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","recommendationQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"shadcn/ui","domain":"github.com/shadcn/ui","recommendation":"positive","mentionQuote":"\"shadcn/ui is a collection of beautifully-designed, accessible components and a code distribution platform.\"","recommendationQuote":"\"shadcn/ui is a collection of beautifully-designed, accessible components and a code distribution platform.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"MUI","domain":"mui.com","recommendation":"positive","mentionQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","recommendationQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Semantic UI React","domain":"react.semantic-ui.com","recommendation":"positive","mentionQuote":"\"Semantic UI React provides React components.\"","recommendationQuote":"\"Semantic UI React provides React components.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Chakra UI","domain":"chakra-ui.com","recommendation":"positive","mentionQuote":"\"Chakra UI is a component system for building products with speed.\"","recommendationQuote":"\"Chakra UI is a component system for building products with speed.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Bootstrap","domain":"getbootstrap.com","recommendation":"positive","mentionQuote":"\"Bootstrap is the most popular HTML, CSS, and JavaScript framework for developing responsive, mobile</pre>

</details>

SHA-256: `e28f6793827d5dd65cfdae31983bb0ebb251e7f24988fe3e09e1e7596242bf96`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · google/gemini-2.5-flash-lite

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 7fa563e8-49d8-4fc7-827d-8211be751850 · probeId: a8a48ffe-0a7e-43ad-8ee0-d1240b25f9cb

off · completed · firstAttemptId: 96db102f-5723-4d3c-8ba2-a37c3f9f8c70

analysisStatus: completed · resultAttemptId: 96db102f-5723-4d3c-8ba2-a37c3f9f8c70

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development · recommendation: — · attemptId: 96db102f-5723-4d3c-8ba2-a37c3f9f8c70

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt 96db102f-5723-4d3c-8ba2-a37c3f9f8c70

completed · Observed at: 2026-09-08T06:02:15.394Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-96db102f-5723-4d3c-8ba2-a37c3f9f8c70"></a>

<details><summary>Read the original answer</summary>

<pre>{
  "analysisStatus": "completed",
  "mentions": [
    {
      "name": "Frontend Development",
      "domain": null,
      "recommendation": "mentioned",
      "mentionQuote": "Frontend Development",
      "recommendationQuote": null,
      "firstMentionOffset": 0,
      "firstRecommendationOffset": null,
      "firstMentionState": "unique",
      "firstRecommendationState": "none"
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `c4419356320b9943bf6b7580f6253cd84c9e1ca49c2b67e49f09081d473adff9`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4o-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 8664bb78-863f-4d58-946a-4418cc461445 · probeId: a74e9004-8313-4901-9277-e60888b87aa0

off · completed · firstAttemptId: 48aad923-e494-468c-b6e8-c3c409bfd171

analysisStatus: completed · resultAttemptId: 48aad923-e494-468c-b6e8-c3c409bfd171

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development is a crucial aspect of web development. · recommendation: — · attemptId: 48aad923-e494-468c-b6e8-c3c409bfd171

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt 48aad923-e494-468c-b6e8-c3c409bfd171

completed · Observed at: 2026-09-08T06:04:53.251Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-48aad923-e494-468c-b6e8-c3c409bfd171"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"Frontend Development","domain":null,"recommendation":"mentioned","mentionQuote":"Frontend Development is a crucial aspect of web development.","recommendationQuote":null,"firstMentionOffset":0,"firstRecommendationOffset":null,"firstMentionState":"unique","firstRecommendationState":"none"}],"unknowns":[]}</pre>

</details>

SHA-256: `21e4c2c4f3743ef36803acb9964536f91cd1975fd26c724cf3908994e032ea59`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · google/gemini-2.5-flash-lite

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 8664bb78-863f-4d58-946a-4418cc461445 · probeId: 68460ba0-cba8-415a-92f7-91cb0beaaf05

off · completed · firstAttemptId: 791f2355-eb01-4212-a9fb-3cce5a8cf007

analysisStatus: completed · resultAttemptId: 791f2355-eb01-4212-a9fb-3cce5a8cf007

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- Frontend Development: mentioned · mention: Frontend Development · recommendation: — · attemptId: 791f2355-eb01-4212-a9fb-3cce5a8cf007

Uncertain: —

[Actual request and answer evidence](./public-evidence.json)

#### Attempt 791f2355-eb01-4212-a9fb-3cce5a8cf007

completed · Observed at: 2026-09-08T06:04:47.762Z · First attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-791f2355-eb01-4212-a9fb-3cce5a8cf007"></a>

<details><summary>Read the original answer</summary>

<pre>{
  "analysisStatus": "completed",
  "mentions": [
    {
      "name": "Frontend Development",
      "domain": null,
      "recommendation": "mentioned",
      "mentionQuote": "Frontend Development",
      "recommendationQuote": null,
      "firstMentionOffset": 0,
      "firstRecommendationOffset": null,
      "firstMentionState": "unique",
      "firstRecommendationState": "none"
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `c4419356320b9943bf6b7580f6253cd84c9e1ca49c2b67e49f09081d473adff9`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Frontend Development · openai/gpt-4.1-mini

keywordId: watch-keyword-6af2b440204ecd379022aa62 · runId: 8664bb78-863f-4d58-946a-4418cc461445 · probeId: 1c1fcfac-3899-41bc-9246-15a74cf4cdc8

provider_native · failed · firstAttemptId: edad1b8e-c9aa-47e9-8d1c-930f4aac72f3

analysisStatus: analysis_failed · resultAttemptId: edad1b8e-c9aa-47e9-8d1c-930f4aac72f3

- mentionJudgment: unknown
- recommendationJudgment: unknown


Uncertain: Unterminated string in JSON at position 4396 (line 1 column 4397)

[Actual request and answer evidence](./public-evidence.json)

#### Attempt edad1b8e-c9aa-47e9-8d1c-930f4aac72f3

analysis_failed · Observed at: 2026-09-08T06:04:51.042Z · First attempt

requestedSearch: provider_native · used: true · executionMode: native

OpenRouter metadata confirmed provider-native web search.

Error: analysis_failed · Unterminated string in JSON at position 4396 (line 1 column 4397)

finish_reason: stop

<a id="attempt-edad1b8e-c9aa-47e9-8d1c-930f4aac72f3"></a>

<details><summary>Read the original answer</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"React","domain":"reactjs.org","recommendation":"positive","mentionQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","recommendationQuote":"\"React remains the world’s most popular frontend library for building dynamic user interfaces.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Vue.js","domain":"vuejs.org","recommendation":"positive","mentionQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","recommendationQuote":"\"Vue continues its rise due to developer-friendly architecture and fast learning curve.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Angular","domain":"angular.io","recommendation":"positive","mentionQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","recommendationQuote":"\"Enterprise-level framework with TypeScript, dependency injection, and state management built-in.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Svelte","domain":"svelte.dev","recommendation":"positive","mentionQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles.\"","recommendationQuote":"\"Svelte and SvelteKit are worth serious consideration. Less boilerplate, faster builds, smaller bundles.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Next.js","domain":"nextjs.org","recommendation":"positive","mentionQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","recommendationQuote":"\"Next.js is the most popular React framework for SSR, SSG, and full-stack development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Tailwind CSS","domain":"tailwindcss.com","recommendation":"positive","mentionQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","recommendationQuote":"\"Tailwind CSS is a utility-first CSS framework for rapid UI development.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"shadcn/ui","domain":"github.com/shadcn/ui","recommendation":"positive","mentionQuote":"\"shadcn/ui is a collection of beautifully-designed, accessible components and a code distribution platform.\"","recommendationQuote":"\"shadcn/ui is a collection of beautifully-designed, accessible components and a code distribution platform.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"MUI","domain":"mui.com","recommendation":"positive","mentionQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","recommendationQuote":"\"MUI is a comprehensive suite of free UI tools to help you ship new features faster.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Semantic UI React","domain":"react.semantic-ui.com","recommendation":"positive","mentionQuote":"\"Semantic UI React provides React components.\"","recommendationQuote":"\"Semantic UI React provides React components.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Chakra UI","domain":"chakra-ui.com","recommendation":"positive","mentionQuote":"\"Chakra UI is a component system for building products with speed.\"","recommendationQuote":"\"Chakra UI is a component system for building products with speed.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Bootstrap","domain":"getbootstrap.com","recommendation":"positive","mentionQuote":"\"Bootstrap is the most popular HTML, CSS, and JavaScript framework for developing responsive, mobile-first websites.\"","recommendationQuote":"\"Bootstrap is the most popular HTML,</pre>

</details>

SHA-256: `8ea61418528f2ab1f8bc2bbb8c8a2e6f38bc32ecd24cdbc85365e71d2b0c990a`

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

## Repeated observations

3 archived measurement runs; this count does not imply all succeeded. Compare only identical model, language, search and fingerprint conditions. Short repeats do not establish a long-term trend or a causal effect.

- Run 07cb5c01-7756-4a97-a4fb-1d70a3792c2f: partial
- Run 7fa563e8-49d8-4fc7-827d-8211be751850: partial
- Run 8664bb78-863f-4d58-946a-4418cc461445: partial

- D 4e8f7b60-2a2f-4c34-85a7-dec41394db62 · google/gemini-2.5-flash-lite · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 37c41145-de67-4f60-a640-22b49efbb890 · resultAttemptId: 37c41145-de67-4f60-a640-22b49efbb890
- D a1564c6b-1f37-46bb-bfd7-f4ca414bded7 · openai/gpt-4o-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: eb197f10-e24f-4311-8285-8053a3da774d · resultAttemptId: eb197f10-e24f-4311-8285-8053a3da774d
- D 377f8d2a-3ea5-4076-9282-5e5742e53832 · openai/gpt-4.1-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: da8fa86e-8b81-4bd0-a86f-258cdd807963 · resultAttemptId: da8fa86e-8b81-4bd0-a86f-258cdd807963
- D ea47db84-e07d-4de3-b95b-df9a91801f46 · openai/gpt-4o-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 8a479e68-8bfc-4ae9-9bb0-c64d176517c7 · resultAttemptId: 8a479e68-8bfc-4ae9-9bb0-c64d176517c7
- D 8acbc4a2-0c2c-40c2-9c6d-e9ca0e84f061 · openai/gpt-4.1-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: f4aff0ba-89f8-48ed-b806-546927f0de8c · resultAttemptId: f4aff0ba-89f8-48ed-b806-546927f0de8c
- D 3870fff6-f30b-4bbb-9f03-ef86cd5dc501 · google/gemini-2.5-flash-lite · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 46dbedc9-459d-4f5d-99ce-ced9cb14a6cd · resultAttemptId: 46dbedc9-459d-4f5d-99ce-ced9cb14a6cd
- D 930b51ee-0ec1-4fd9-bdfd-9736c79a03a7 · openai/gpt-4o-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 4d69ec1c-f33f-4e82-93be-d3f128864f4f · resultAttemptId: 4d69ec1c-f33f-4e82-93be-d3f128864f4f
- D ecba83b6-692f-49e2-a3d6-ed03aa9661c8 · google/gemini-2.5-flash-lite · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 571f7773-1af5-4a51-b503-a6b7b3ee4254 · resultAttemptId: 571f7773-1af5-4a51-b503-a6b7b3ee4254
- D 7fdb1aba-5116-490b-8f63-b192f73c9f8f · openai/gpt-4.1-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: a03c64c6-164b-454e-8283-3040cc40bb48 · resultAttemptId: a03c64c6-164b-454e-8283-3040cc40bb48

### Schedule archive

Task status at collection (historical snapshot): active

Final archived task status: paused · nextRunAt: — · updatedAt: 2026-09-08T06:05:02.803Z

product-data/projects/63bdc2d8-2f1d-48d1-9aca-ac944b47fb49/schedules/tasks/3d2cd7fe-2df3-4752-8794-e7813a144936.json · SHA-256: `991c8a8cb0e9639ce45123ed7fbdb182308ec1bc19dbc30afe104778b94b7d50`

- Occurrence 6dd64f39-9553-4732-bb57-0619d2bc8c66: completed · reason: run_partial_or_failed · runId: 8664bb78-863f-4d58-946a-4418cc461445 · scheduledFor: 2026-09-08T06:03:00.000Z

Occurrence completed means scheduling finished; a linked partial/failed run remains partial or failed.

## Product screenshots

![vercel.com: original answers and source categories](../../../assets/screenshots/v0.2.0-rc.1/R02-answers.png)

R02 · vercel.com · D · 3 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:01:42.187Z to 2026-09-08T06:01:42.187Z. Original failures remain visible.

Captured: 2026-09-08T07:18:49.917Z.

![vercel.com: actual neutral keyword measurements](../../../assets/screenshots/v0.2.0-rc.1/R02-keywords.png)

R02 · vercel.com · D/K · 18 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:01:54.266Z to 2026-09-08T06:04:51.042Z. Original failures remain visible.

Captured: 2026-09-08T07:18:54.520Z.

![vercel.com: measurement point and original-answer evidence](../../../assets/screenshots/v0.2.0-rc.1/R02-point-evidence.png)

R02 · vercel.com · D/K · 18 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:01:54.266Z to 2026-09-08T06:04:51.042Z. Original failures remain visible.

Captured: 2026-09-08T07:18:56.217Z.

## Inspect or remeasure

[Case configuration](./case.json) · [Evidence index](./evidence-index.json) · [Public evidence bundle](./public-evidence.json)

SHA-256: `9dfb542106e61a68ed376e73df3fc967fb9f6eb60fc79b19b1e99757916f0928`

Historical case cost (not this documentation update): USD 0.10424000 · 21 calls · 76758 Token.

[Export source](../../../examples/lib/export.mjs) · [Candidate provenance and unpublished status](../../../docs/releases/v0.2.0-rc.1.md)

```bash
npm run examples:plan -- --case R02
npm run examples:replay -- --case R02 --evidence examples/cases/R02/public-evidence.json
```

Remeasurement incurs costs and requires an isolated product service, a frozen plan and explicit live authorization. Reading and exporting do not call models.

## Limits and disclosure

This is a public-product observation. Inclusion does not imply a partnership or endorsement.

Model descriptions are not verified market facts. A returned source does not establish that its content is correct or caused a recommendation. Unknown, missing, analysis failure and request failure remain separate. Use the evidence to investigate descriptions or sources, not to assert optimization caused a difference.

- Run 07cb5c01-7756-4a97-a4fb-1d70a3792c2f: partial
- Run 7fa563e8-49d8-4fc7-827d-8211be751850: partial
- Run 8664bb78-863f-4d58-946a-4418cc461445: partial
- Probe e981e3e9-555a-4ad9-9c9a-5300c07213e3: failed; first attempt analysis_failed
- Probe e981e3e9-555a-4ad9-9c9a-5300c07213e3: missing or failed analysis
- Probe 83eae328-7e7e-46e8-96a0-262b3f75e032: failed; first attempt analysis_failed
- Probe 83eae328-7e7e-46e8-96a0-262b3f75e032: missing or failed analysis
- Probe 1c1fcfac-3899-41bc-9246-15a74cf4cdc8: failed; first attempt analysis_failed
- Probe 1c1fcfac-3899-41bc-9246-15a74cf4cdc8: missing or failed analysis
- Attempt 027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3: analysis_failed; Unterminated string in JSON at position 4387 (line 1 column 4388)
- Attempt e847731b-ed41-455c-801a-03f4e75598ae: analysis_failed; Unterminated string in JSON at position 4384 (line 1 column 4385)
- Attempt edad1b8e-c9aa-47e9-8d1c-930f4aac72f3: analysis_failed; Unterminated string in JSON at position 4396 (line 1 column 4397)
- Occurrence 6dd64f39-9553-4732-bb57-0619d2bc8c66: completed; run_partial_or_failed
