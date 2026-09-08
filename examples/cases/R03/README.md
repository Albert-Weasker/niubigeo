# R03 · supabase.com

[简体中文](./README.zh-CN.md) · [All cases](../../README.md)

## Observed result

Models described a Firebase alternative; no eligible neutral keyword test was established.

Initial D: 3/3 analyzable current answers. Measurement D: 3/3 analyzable first answers. K: 0/0 analyzable first answers. These are answer-coverage counts, not recognition rates or product metric denominators.

Execution status: **completed**.

![supabase.com: individual domain recognition results](../../../assets/screenshots/v0.2.0-rc.1/R03-models.png)

R03 · supabase.com · D · 3 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:05:02.831Z to 2026-09-08T06:05:02.831Z. Original failures remain visible. Captured: 2026-09-08T07:18:56.808Z.

## Conditions

Input domain: supabase.com. Answer language: zh.

Protocols: D = domain-recognition/v1; K = keyword-discovery/v1.

D receives the domain, language, fixed protocol and model settings. K receives a frozen neutral keyword. Browsing categories are not sent to models.

- openai/gpt-4o-mini · off
- google/gemini-2.5-flash-lite · off
- openai/gpt-4.1-mini · provider_native

## Model observations

### OpenAI: GPT-4.1 Mini

**Observed at:** 2026-09-08T06:05:02.831Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: 5adbf376-48fe-4063-a506-84624980ee70 · completed · executionMode: native.

Brand: Supabase

Business: Supabase是一家提供后端基础设施的开发平台，包括数据库、身份验证、存储、边缘函数等服务。该平台是开源的，但公司通过其托管的云平台和在亚马逊网络服务（AWS）上运行的企业产品获得收入。Supabase被视为Firebase的开源替代品。

Original span: UTF-16 [153, 273) · [Full answer](#attempt-5adbf376-48fe-4063-a506-84624980ee70)

Category: 开发者工具与基础设施、数据库

Brand keywords: Supabase

Competitors named by this model:

- Firebase · firebase.google.com: Firebase是由Google提供的开发平台，提供实时数据库、身份验证、托管等服务，旨在帮助开发者构建高质量的应用。. Keywords: 实时数据库

Uncertain: —


<a id="attempt-5adbf376-48fe-4063-a506-84624980ee70"></a>

<details><summary>Read the original answer</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Supabase","citationUrls":[]},"businessDescription":{"value":"Supabase是一家提供后端基础设施的开发平台，包括数据库、身份验证、存储、边缘函数等服务。该平台是开源的，但公司通过其托管的云平台和在亚马逊网络服务（AWS）上运行的企业产品获得收入。Supabase被视为Firebase的开源替代品。","citationUrls":[]},"productCategory":{"value":"开发者工具与基础设施、数据库","citationUrls":[]},"competitors":[{"name":"Firebase","domain":"firebase.google.com","businessDescription":"Firebase是由Google提供的开发平台，提供实时数据库、身份验证、托管等服务，旨在帮助开发者构建高质量的应用。","productCategory":"开发者工具与基础设施、数据库","keywords":[{"keyword":"实时数据库","citationUrls":[]}],"citationUrls":[]}],"brandKeywords":[{"keyword":"Supabase","citationUrls":[]}],"unknowns":[]}</pre>

</details>

SHA-256: `efd2d2f35a10c165d92b17da8112a7aeb577e9eef48af55c9551e00a0ce39c88`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `efd2d2f35a10c165d92b17da8112a7aeb577e9eef48af55c9551e00a0ce39c88`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Supabase | Supabase | Supabase [92, 100) |
| Firebase | 实时数据库 | 实时数据库 [471, 476) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### OpenAI: GPT-4o-mini

**Observed at:** 2026-09-08T06:05:02.831Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: ad12277b-d5d3-4489-80cc-e9d79fc3e01a · completed · executionMode: unverified.

Brand: Supabase

Business: 开源后端即服务平台

Original span: UTF-16 [153, 162) · [Full answer](#attempt-ad12277b-d5d3-4489-80cc-e9d79fc3e01a)

Category: 数据库

Brand keywords: 开源, 后端即服务, 实时功能

Competitors named by this model:

- Firebase · firebase.google.com: 移动和Web应用程序开发平台. Keywords: 实时数据库, 身份验证, 云存储
- AWS Amplify · aws.amazon.com/amplify: 构建和部署全栈应用程序的服务. Keywords: 云计算, 全栈开发, 托管服务

Uncertain: —


<a id="attempt-ad12277b-d5d3-4489-80cc-e9d79fc3e01a"></a>

<details><summary>Read the original answer</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Supabase","citationUrls":[]},"businessDescription":{"value":"开源后端即服务平台","citationUrls":[]},"productCategory":{"value":"数据库","citationUrls":[]},"competitors":[{"name":"Firebase","domain":"firebase.google.com","businessDescription":"移动和Web应用程序开发平台","productCategory":"后端服务","keywords":[{"keyword":"实时数据库","citationUrls":[]},{"keyword":"身份验证","citationUrls":[]},{"keyword":"云存储","citationUrls":[]}],"citationUrls":[]},{"name":"AWS Amplify","domain":"aws.amazon.com/amplify","businessDescription":"构建和部署全栈应用程序的服务","productCategory":"后端服务","keywords":[{"keyword":"云计算","citationUrls":[]},{"keyword":"全栈开发","citationUrls":[]},{"keyword":"托管服务","citationUrls":[]}],"citationUrls":[]}],"brandKeywords":[{"keyword":"开源","citationUrls":[]},{"keyword":"后端即服务","citationUrls":[]},{"keyword":"实时功能","citationUrls":[]}],"unknowns":[]}</pre>

</details>

SHA-256: `73aa2f9d1b3c7ff69912a3c723b7fc5bcb1f46815f0f59f44341276ac24d8078`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `73aa2f9d1b3c7ff69912a3c723b7fc5bcb1f46815f0f59f44341276ac24d8078`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Supabase | 开源 | 开源 [153, 155) |
| Supabase | 后端即服务 | 后端即服务 [155, 160) |
| Supabase | 实时功能 | 实时功能 [872, 876) |
| Firebase | 实时数据库 | 实时数据库 [388, 393) |
| Firebase | 身份验证 | 身份验证 [426, 430) |
| Firebase | 云存储 | 云存储 [463, 466) |
| AWS Amplify | 云计算 | 云计算 [651, 654) |
| AWS Amplify | 全栈开发 | 全栈开发 [687, 691) |
| AWS Amplify | 托管服务 | 托管服务 [724, 728) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

### Google: Gemini 2.5 Flash Lite

**Observed at:** 2026-09-08T06:05:02.831Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: dc8e631b-2694-47a2-be94-ce2376506927 · completed · executionMode: unverified.

Brand: Supabase

Business: 一个开源的 Firebase 替代品，允许您使用 PostgreSQL 创建您的应用程序。

Original span: UTF-16 [190, 235) · [Full answer](#attempt-dc8e631b-2694-47a2-be94-ce2376506927)

Category: 后端即服务

Brand keywords: 开源 Firebase 替代品, PostgreSQL, 数据库即服务, 身份验证, 实时订阅, 存储

Competitors named by this model:

- Firebase · firebase.google.com: 一个由 Google 开发的应用程序开发平台，提供一系列工具和服务，帮助开发人员构建、改进和发展他们的应用程序。. Keywords: 后端即服务, 移动应用开发, Web 应用开发
- AWS Amplify · aws.amazon.com/amplify/: 一个由 Amazon Web Services (AWS) 提供的一套工具和服务的集合，用于构建、部署和托管全栈 Web 和移动应用程序。. Keywords: 后端即服务, 云开发, 全栈开发
- Heroku · www.heroku.com: 一个基于云的平台即服务 (PaaS)，用于部署、管理和扩展应用程序。. Keywords: 平台即服务, 应用部署, 云托管

Uncertain: —


<a id="attempt-dc8e631b-2694-47a2-be94-ce2376506927"></a>

<details><summary>Read the original answer</summary>

<pre>{
  "domainRecognition": "recognized",
  "analysisStatus": "recognized",
  "recognizedBrand": {
    "value": "Supabase",
    "citationUrls": []
  },
  "businessDescription": {
    "value": "一个开源的 Firebase 替代品，允许您使用 PostgreSQL 创建您的应用程序。",
    "citationUrls": []
  },
  "productCategory": {
    "value": "后端即服务",
    "citationUrls": []
  },
  "competitors": [
    {
      "name": "Firebase",
      "domain": "firebase.google.com",
      "businessDescription": "一个由 Google 开发的应用程序开发平台，提供一系列工具和服务，帮助开发人员构建、改进和发展他们的应用程序。",
      "productCategory": "后端即服务",
      "keywords": [
        {
          "keyword": "后端即服务",
          "citationUrls": []
        },
        {
          "keyword": "移动应用开发",
          "citationUrls": []
        },
        {
          "keyword": "Web 应用开发",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "AWS Amplify",
      "domain": "aws.amazon.com/amplify/",
      "businessDescription": "一个由 Amazon Web Services (AWS) 提供的一套工具和服务的集合，用于构建、部署和托管全栈 Web 和移动应用程序。",
      "productCategory": "后端即服务",
      "keywords": [
        {
          "keyword": "后端即服务",
          "citationUrls": []
        },
        {
          "keyword": "云开发",
          "citationUrls": []
        },
        {
          "keyword": "全栈开发",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "Heroku",
      "domain": "www.heroku.com",
      "businessDescription": "一个基于云的平台即服务 (PaaS)，用于部署、管理和扩展应用程序。",
      "productCategory": "平台即服务",
      "keywords": [
        {
          "keyword": "平台即服务",
          "citationUrls": []
        },
        {
          "keyword": "应用部署",
          "citationUrls": []
        },
        {
          "keyword": "云托管",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    }
  ],
  "brandKeywords": [
    {
      "keyword": "开源 Firebase 替代品",
      "citationUrls": []
    },
    {
      "keyword": "PostgreSQL",
      "citationUrls": []
    },
    {
      "keyword": "数据库即服务",
      "citationUrls": []
    },
    {
      "keyword": "身份验证",
      "citationUrls": []
    },
    {
      "keyword": "实时订阅",
      "citationUrls": []
    },
    {
      "keyword": "存储",
      "citationUrls": []
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `98b48174e6c4380f6f56db3206101fb758b87eaf1082e2c2bc276f4d09df820f`

[Answer, field offsets and attempts](./public-evidence.json) · SHA-256: `98b48174e6c4380f6f56db3206101fb758b87eaf1082e2c2bc276f4d09df820f`

<details><summary>Keyword provenance and original spans</summary>

| Owner | Keyword | Original text / UTF-16 span |
|---|---|---|
| Supabase | 开源 Firebase 替代品 | 开源 Firebase 替代品 [1878, 1893) |
| Supabase | PostgreSQL | PostgreSQL [215, 225) |
| Supabase | 数据库即服务 | 数据库即服务 [2021, 2027) |
| Supabase | 身份验证 | 身份验证 [2086, 2090) |
| Supabase | 实时订阅 | 实时订阅 [2149, 2153) |
| Supabase | 存储 | 存储 [2212, 2214) |
| Firebase | 后端即服务 | 后端即服务 [303, 308) |
| Firebase | 移动应用开发 | 移动应用开发 [684, 690) |
| Firebase | Web 应用开发 | Web 应用开发 [765, 773) |
| AWS Amplify | 后端即服务 | 后端即服务 [303, 308) |
| AWS Amplify | 云开发 | 云开发 [1202, 1205) |
| AWS Amplify | 全栈开发 | 全栈开发 [1280, 1284) |
| Heroku | 平台即服务 | 平台即服务 [1467, 1472) |
| Heroku | 应用部署 | 应用部署 [1664, 1668) |
| Heroku | 云托管 | 云托管 [1743, 1746) |

</details>

#### Provider citations

No sources of this type were archived for this attempt.

#### Search retrieval results

No sources of this type were archived for this attempt.

#### Links in the answer (not Provider citations)

No answer URLs were archived for this attempt.

## Neutral keyword tests

Keyword tests were not run: the frozen selection yielded no eligible terms. Sources and exclusions remain in archiveContext.keywordManifest in public-evidence.json; no terms or runs were added.

K valid counts analyzable first-attempt answers only, not product metric denominators. Inspect archived metric samples, included flags and judgments. A later successful retry does not replace this coverage count.

Selection records, exact quotes and exclusions are in the evidence file. Each answer observes the target and other entities under the same conditions; offline and online differences are not model rankings.

## Repeated observations

1 archived measurement runs; this count does not imply all succeeded. Compare only identical model, language, search and fingerprint conditions. Short repeats do not establish a long-term trend or a causal effect.

- Run 7d13fc02-50ff-4df8-a555-1b4bec3177f4: completed

- D 68d75a7e-b840-48de-9d26-cb79a1d5511e · openai/gpt-4o-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 9410a35a-282f-45ec-b88e-eb66a2fe5cf3 · resultAttemptId: 9410a35a-282f-45ec-b88e-eb66a2fe5cf3
- D 87978829-4a30-4c6d-8ee6-97ef5c2ba8ae · openai/gpt-4.1-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: e12b3917-d9df-43aa-b6db-ec069c0588c5 · resultAttemptId: e12b3917-d9df-43aa-b6db-ec069c0588c5
- D 7099e2ef-461e-4fea-a98f-ae8778be9927 · google/gemini-2.5-flash-lite · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: cd34204a-8881-4c43-98d4-b5f66b484874 · resultAttemptId: cd34204a-8881-4c43-98d4-b5f66b484874

## Product screenshots

![supabase.com: original answers and source categories](../../../assets/screenshots/v0.2.0-rc.1/R03-answers.png)

R03 · supabase.com · D · 3 archived attempts · openai/gpt-4o-mini (off), google/gemini-2.5-flash-lite (off), openai/gpt-4.1-mini (provider_native) · 2026-09-08T06:05:02.831Z to 2026-09-08T06:05:02.831Z. Original failures remain visible.

Captured: 2026-09-08T07:18:57.190Z.

## Inspect or remeasure

[Case configuration](./case.json) · [Evidence index](./evidence-index.json) · [Public evidence bundle](./public-evidence.json)

SHA-256: `d679d1755b77e7a4184c6304c464eb18c89f9683188481dd7ff6d789b4ff0eaa`

Historical case cost (not this documentation update): USD 0.02960950 · 6 calls · 22875 Token.

[Export source](../../../examples/lib/export.mjs) · [Candidate provenance and unpublished status](../../../docs/releases/v0.2.0-rc.1.md)

```bash
npm run examples:plan -- --case R03
npm run examples:replay -- --case R03 --evidence examples/cases/R03/public-evidence.json
```

Remeasurement incurs costs and requires an isolated product service, a frozen plan and explicit live authorization. Reading and exporting do not call models.

## Limits and disclosure

This is a public-product observation. Inclusion does not imply a partnership or endorsement.

Model descriptions are not verified market facts. A returned source does not establish that its content is correct or caused a recommendation. Unknown, missing, analysis failure and request failure remain separate. Use the evidence to investigate descriptions or sources, not to assert optimization caused a difference.

