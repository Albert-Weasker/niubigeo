# R10 · replit.com

[English](./README.md) · [全部案例](../../README.zh-CN.md)

## 本次实际结果

模型描述浏览器 IDE；关键词结果含两项第一名冲突。

初始 D：3/3 条当前回答可分析；测量 D：3/3 条首次回答可分析；K：2/3 条首次回答可分析。这些是回答覆盖计数，不是认识率或产品指标分母。

执行状态: **部分完成**.

**该指标存在一致性冲突，暂不用于排名比较。** 下列唯一第一名字段仍保留原始值，不选择冠军，也不解释为并列。

- [firstMentionState · 177f67e8-6b8a-4a18-93df-23f4e591c93f](../../../docs/known-issues.md#conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstmentionstate)
- [firstRecommendationState · 177f67e8-6b8a-4a18-93df-23f4e591c93f](../../../docs/known-issues.md#conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstrecommendationstate)

![replit.com：各模型域名认知结果](../../../assets/screenshots/v0.2.0-rc.1/R10-models.png)

R10 · replit.com · D · 3 条归档尝试 · openai/gpt-4o-mini（off）、google/gemini-2.5-flash-lite（off）、openai/gpt-4.1-mini（provider_native） · 2026-09-08T06:09:26.484Z 至 2026-09-08T06:09:26.484Z。保留原始失败状态。 截图时间: 2026-09-08T07:19:05.322Z.

## 测试条件

输入域名: replit.com. 回答语言: en.

协议: D = domain-recognition/v1; K = keyword-discovery/v1.

D 只接收域名、语言、固定协议与模型配置。K 只接收已冻结的中性关键词。分类标签不发送给模型。

- openai/gpt-4o-mini · off
- google/gemini-2.5-flash-lite · off
- openai/gpt-4.1-mini · provider_native

## 各模型的描述

### Google: Gemini 2.5 Flash Lite

**运行时间:** 2026-09-08T06:09:26.484Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: d79c2a93-ae63-498f-9d8f-f70cb116a4d1 · completed · executionMode: unverified.

品牌: Replit

业务: Replit is an online integrated development environment (IDE) that allows users to write, run, and share code in various programming languages directly from their web browser. It provides a collaborative coding environment, hosting capabilities, and tools for building and deploying applications.

原文位置: UTF-16 [188, 483) · [打开完整回答](#attempt-d79c2a93-ae63-498f-9d8f-f70cb116a4d1)

类别: Online IDE, Cloud Development Platform, Collaborative Coding

目标关键词: online IDE, collaborative coding, run code online, coding platform, web development

竞争对象:

- GitHub Codespaces · github.com: GitHub Codespaces is a cloud-based development environment that provides a full IDE experience directly in the browser or on a local machine. It integrates with GitHub repositories and offers pre-configured development environments.. 关键词: cloud development, online IDE, coding environment
- Gitpod · gitpod.io: Gitpod is an open-source online IDE that automates the provisioning of ready-to-code development environments. It integrates with Git repositories and allows developers to start coding in seconds.. 关键词: automated development, online IDE, cloud development
- AWS Cloud9 · aws.amazon.com/cloud9/: AWS Cloud9 is a cloud-based integrated development environment (IDE) that lets you write, run, and debug your code with just a browser. It provides a pre-configured cloud-based toolkit that runs on Amazon EC2 instances.. 关键词: cloud IDE, development environment, AWS

无法确认: —


<a id="attempt-d79c2a93-ae63-498f-9d8f-f70cb116a4d1"></a>

<details><summary>查看模型原始回答</summary>

<pre>{
  "domainRecognition": "recognized",
  "analysisStatus": "recognized",
  "recognizedBrand": {
    "value": "Replit",
    "citationUrls": []
  },
  "businessDescription": {
    "value": "Replit is an online integrated development environment (IDE) that allows users to write, run, and share code in various programming languages directly from their web browser. It provides a collaborative coding environment, hosting capabilities, and tools for building and deploying applications.",
    "citationUrls": []
  },
  "productCategory": {
    "value": "Online IDE, Cloud Development Platform, Collaborative Coding",
    "citationUrls": []
  },
  "competitors": [
    {
      "name": "GitHub Codespaces",
      "domain": "github.com",
      "businessDescription": "GitHub Codespaces is a cloud-based development environment that provides a full IDE experience directly in the browser or on a local machine. It integrates with GitHub repositories and offers pre-configured development environments.",
      "productCategory": "Cloud IDE, Development Environment",
      "keywords": [
        {
          "keyword": "cloud development",
          "citationUrls": []
        },
        {
          "keyword": "online IDE",
          "citationUrls": []
        },
        {
          "keyword": "coding environment",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "Gitpod",
      "domain": "gitpod.io",
      "businessDescription": "Gitpod is an open-source online IDE that automates the provisioning of ready-to-code development environments. It integrates with Git repositories and allows developers to start coding in seconds.",
      "productCategory": "Cloud IDE, Automated Development Environment",
      "keywords": [
        {
          "keyword": "automated development",
          "citationUrls": []
        },
        {
          "keyword": "online IDE",
          "citationUrls": []
        },
        {
          "keyword": "cloud development",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    },
    {
      "name": "AWS Cloud9",
      "domain": "aws.amazon.com/cloud9/",
      "businessDescription": "AWS Cloud9 is a cloud-based integrated development environment (IDE) that lets you write, run, and debug your code with just a browser. It provides a pre-configured cloud-based toolkit that runs on Amazon EC2 instances.",
      "productCategory": "Cloud IDE, Integrated Development Environment",
      "keywords": [
        {
          "keyword": "cloud IDE",
          "citationUrls": []
        },
        {
          "keyword": "development environment",
          "citationUrls": []
        },
        {
          "keyword": "AWS",
          "citationUrls": []
        }
      ],
      "citationUrls": []
    }
  ],
  "brandKeywords": [
    {
      "keyword": "online IDE",
      "citationUrls": []
    },
    {
      "keyword": "collaborative coding",
      "citationUrls": []
    },
    {
      "keyword": "run code online",
      "citationUrls": []
    },
    {
      "keyword": "coding platform",
      "citationUrls": []
    },
    {
      "keyword": "web development",
      "citationUrls": []
    }
  ],
  "unknowns": []
}</pre>

</details>

SHA-256: `0c219ccab354e7749f5d404cd36cd75d217fed287c9db8bfbbfa6aef7cbc3d9f`

[原始回答、字段位置与尝试记录](./public-evidence.json) · SHA-256: `0c219ccab354e7749f5d404cd36cd75d217fed287c9db8bfbbfa6aef7cbc3d9f`

<details><summary>关键词与原文位置</summary>

| 归属 | 关键词 | 原文 / UTF-16 位置 |
|---|---|---|
| Replit | online IDE | online IDE [1204, 1214) |
| Replit | collaborative coding | collaborative coding [377, 397) |
| Replit | run code online | run code online [3003, 3018) |
| Replit | coding platform | coding platform [3077, 3092) |
| Replit | web development | web development [3151, 3166) |
| GitHub Codespaces | cloud development | cloud development [1112, 1129) |
| GitHub Codespaces | online IDE | online IDE [1204, 1214) |
| GitHub Codespaces | coding environment | coding environment [391, 409) |
| Gitpod | automated development | automated development [1803, 1824) |
| Gitpod | online IDE | online IDE [1204, 1214) |
| Gitpod | cloud development | cloud development [1112, 1129) |
| AWS Cloud9 | cloud IDE | cloud IDE [2538, 2547) |
| AWS Cloud9 | development environment | development environment [219, 242) |
| AWS Cloud9 | AWS | AWS [2105, 2108) |

</details>

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

此 Attempt 未归档正文 URL。

### OpenAI: GPT-4o-mini

**运行时间:** 2026-09-08T06:09:26.484Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: 2ffd9249-554f-404e-8e64-d47ae11253e0 · completed · executionMode: unverified.

品牌: Replit

业务: An online platform that allows users to write, run, and share code in various programming languages.

原文位置: UTF-16 [151, 251) · [打开完整回答](#attempt-2ffd9249-554f-404e-8e64-d47ae11253e0)

类别: Coding platform

目标关键词: coding, programming, collaboration

竞争对象:

- GitHub · github.com: A platform for version control and collaboration, allowing developers to work together on projects.. 关键词: version control, collaboration, open source
- Glitch · glitch.com: A platform for creating and sharing web applications and projects.. 关键词: web applications, collaboration, coding
- CodePen · codepen.io: An online community for testing and showcasing user-created HTML, CSS, and JavaScript code snippets.. 关键词: HTML, CSS, JavaScript

无法确认: —


<a id="attempt-2ffd9249-554f-404e-8e64-d47ae11253e0"></a>

<details><summary>查看模型原始回答</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Replit","citationUrls":[]},"businessDescription":{"value":"An online platform that allows users to write, run, and share code in various programming languages.","citationUrls":[]},"productCategory":{"value":"Coding platform","citationUrls":[]},"competitors":[{"name":"GitHub","domain":"github.com","businessDescription":"A platform for version control and collaboration, allowing developers to work together on projects.","productCategory":"Code hosting and collaboration","keywords":[{"keyword":"version control","citationUrls":[]},{"keyword":"collaboration","citationUrls":[]},{"keyword":"open source","citationUrls":[]}],"citationUrls":[]},{"name":"Glitch","domain":"glitch.com","businessDescription":"A platform for creating and sharing web applications and projects.","productCategory":"Web development platform","keywords":[{"keyword":"web applications","citationUrls":[]},{"keyword":"collaboration","citationUrls":[]},{"keyword":"coding","citationUrls":[]}],"citationUrls":[]},{"name":"CodePen","domain":"codepen.io","businessDescription":"An online community for testing and showcasing user-created HTML, CSS, and JavaScript code snippets.","productCategory":"Front-end development","keywords":[{"keyword":"HTML","citationUrls":[]},{"keyword":"CSS","citationUrls":[]},{"keyword":"JavaScript","citationUrls":[]}],"citationUrls":[]}],"brandKeywords":[{"keyword":"coding","citationUrls":[]},{"keyword":"programming","citationUrls":[]},{"keyword":"collaboration","citationUrls":[]}],"unknowns":[]}</pre>

</details>

SHA-256: `9ef4b08af8726bb357bd15ca4fb48ec8618689a2f193fa0a68027352bd2862cd`

[原始回答、字段位置与尝试记录](./public-evidence.json) · SHA-256: `9ef4b08af8726bb357bd15ca4fb48ec8618689a2f193fa0a68027352bd2862cd`

<details><summary>关键词与原文位置</summary>

| 归属 | 关键词 | 原文 / UTF-16 位置 |
|---|---|---|
| Replit | coding | coding [1029, 1035) |
| Replit | programming | programming [229, 240) |
| Replit | collaboration | collaboration [448, 461) |
| GitHub | version control | version control [428, 443) |
| GitHub | collaboration | collaboration [448, 461) |
| GitHub | open source | open source [683, 694) |
| Glitch | web applications | web applications [833, 849) |
| Glitch | collaboration | collaboration [448, 461) |
| Glitch | coding | coding [1029, 1035) |
| CodePen | HTML | HTML [1199, 1203) |
| CodePen | CSS | CSS [1205, 1208) |
| CodePen | JavaScript | JavaScript [1214, 1224) |

</details>

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

此 Attempt 未归档正文 URL。

### OpenAI: GPT-4.1 Mini

**运行时间:** 2026-09-08T06:09:26.484Z

domainRecognition: recognized · analysisStatus: recognized · localAnalysis: complete.

Attempt: a2e65acc-77ca-4287-af54-a9e6fc2618ea · completed · executionMode: native.

品牌: Replit

业务: Replit is an American technology company that developed an online integrated development environment (IDE) supporting various programming languages.

原文位置: UTF-16 [171, 319) · [打开完整回答](#attempt-a2e65acc-77ca-4287-af54-a9e6fc2618ea)

类别: Online Integrated Development Environment (IDE)

目标关键词: Replit, Online IDE

竞争对象:

- GitHub Codespaces · github.com/codespaces: GitHub Codespaces is a cloud-based development environment provided by GitHub, offering instant development environments for coding projects.. 关键词: GitHub Codespaces, Cloud-based Development Environment
- Glitch · glitch.com: Glitch is a collaborative platform for building and sharing web apps, providing an in-browser code editor and instant deployment.. 关键词: Glitch, Collaborative Web App Platform
- CodeSandbox · codesandbox.io: CodeSandbox is an online code editor and prototyping tool that enables developers to create web applications quickly.. 关键词: CodeSandbox, Online Code Editor

无法确认: —


<a id="attempt-a2e65acc-77ca-4287-af54-a9e6fc2618ea"></a>

<details><summary>查看模型原始回答</summary>

<pre>{"domainRecognition":"recognized","analysisStatus":"recognized","recognizedBrand":{"value":"Replit","citationUrls":["https://replit.com"]},"businessDescription":{"value":"Replit is an American technology company that developed an online integrated development environment (IDE) supporting various programming languages.","citationUrls":["https://replit.com"]},"productCategory":{"value":"Online Integrated Development Environment (IDE)","citationUrls":["https://replit.com"]},"competitors":[{"name":"GitHub Codespaces","domain":"github.com/codespaces","businessDescription":"GitHub Codespaces is a cloud-based development environment provided by GitHub, offering instant development environments for coding projects.","productCategory":"Cloud-based Development Environment","keywords":[{"keyword":"GitHub Codespaces","citationUrls":["https://github.com/codespaces"]},{"keyword":"Cloud-based Development Environment","citationUrls":["https://github.com/codespaces"]}],"citationUrls":["https://github.com/codespaces"]},{"name":"Glitch","domain":"glitch.com","businessDescription":"Glitch is a collaborative platform for building and sharing web apps, providing an in-browser code editor and instant deployment.","productCategory":"Collaborative Web App Platform","keywords":[{"keyword":"Glitch","citationUrls":["https://glitch.com"]},{"keyword":"Collaborative Web App Platform","citationUrls":["https://glitch.com"]}],"citationUrls":["https://glitch.com"]},{"name":"CodeSandbox","domain":"codesandbox.io","businessDescription":"CodeSandbox is an online code editor and prototyping tool that enables developers to create web applications quickly.","productCategory":"Online Code Editor","keywords":[{"keyword":"CodeSandbox","citationUrls":["https://codesandbox.io"]},{"keyword":"Online Code Editor","citationUrls":["https://codesandbox.io"]}],"citationUrls":["https://codesandbox.io"]}],"brandKeywords":[{"keyword":"Replit","citationUrls":["https://replit.com"]},{"keyword":"Online IDE","citationUrls":["https://replit.com"]}],"unknowns":[]}</pre>

</details>

SHA-256: `224f3c24f0a91ca2cd25a0684df5fa690601bd7a01066890a0d9a9f0df2d8724`

[原始回答、字段位置与尝试记录](./public-evidence.json) · SHA-256: `224f3c24f0a91ca2cd25a0684df5fa690601bd7a01066890a0d9a9f0df2d8724`

<details><summary>关键词与原文位置</summary>

| 归属 | 关键词 | 原文 / UTF-16 位置 |
|---|---|---|
| Replit | Replit | Replit [92, 98) |
| Replit | Online IDE | Online IDE [1972, 1982) |
| GitHub Codespaces | GitHub Codespaces | GitHub Codespaces [500, 517) |
| GitHub Codespaces | Cloud-based Development Environment | Cloud-based Development Environment [737, 772) |
| Glitch | Glitch | Glitch [1026, 1032) |
| Glitch | Collaborative Web App Platform | Collaborative Web App Platform [1229, 1259) |
| CodeSandbox | CodeSandbox | CodeSandbox [1464, 1475) |
| CodeSandbox | Online Code Editor | Online Code Editor [1664, 1682) |

</details>

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

- [https://replit.com/](<https://replit.com/>)
- [https://github.com/codespaces%22]%7D,%7B%22keyword%22:%22Cloud-based](<https://github.com/codespaces%22]%7D,%7B%22keyword%22:%22Cloud-based>)
- [https://github.com/codespaces%22]%7D],%22citationUrls%22:[%22https://github.com/codespaces%22]%7D,%7B%22name%22:%22Glitch%22,%22domain%22:%22glitch.com%22,%22businessDescription%22:%22Glitch](<https://github.com/codespaces%22]%7D],%22citationUrls%22:[%22https://github.com/codespaces%22]%7D,%7B%22name%22:%22Glitch%22,%22domain%22:%22glitch.com%22,%22businessDescription%22:%22Glitch>)
- [https://glitch.com/](<https://glitch.com/>)
- [https://codesandbox.io/](<https://codesandbox.io/>)

## 中性关键词测试

online IDE

K valid 仅指首次 Attempt 的回答可分析，不是产品指标分母。各指标使用归档统计点的 samples、included 和 judgment；后续成功重试不替换此覆盖计数。

筛选记录、原文位置和排除理由见证据文件。每个同条件回答同时观察目标和其他实体，不把离线与联网差异解释为模型优劣。

### online IDE · openai/gpt-4o-mini

keywordId: watch-keyword-d5dd24e84cf2cc4e4cb01f22 · runId: 6a903d55-4c70-4e36-85c0-7742811d3f39 · probeId: 177f67e8-6b8a-4a18-93df-23f4e591c93f

off · completed · firstAttemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545

analysisStatus: completed · resultAttemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

**本回答的唯一第一名判断存在冲突，不用于排名比较。** [冲突证据](../../../docs/known-issues.md)

- Replit: positive · mention: Replit is a popular online IDE that supports multiple programming languages. · recommendation: I recommend Replit for its user-friendly interface and collaborative features. · attemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545
- CodeSandbox: positive · mention: CodeSandbox is another excellent online IDE for web development. · recommendation: CodeSandbox is highly recommended for its integration with GitHub and easy deployment. · attemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545
- Glitch: mentioned · mention: Glitch allows you to create and share web applications easily. · recommendation: — · attemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545
- Gitpod: mentioned · mention: Gitpod provides a cloud-based development environment. · recommendation: — · attemptId: 20f79db0-dfa8-4a4b-8044-3bbfe6447545

无法确认: —

[实际请求与原文证据](./public-evidence.json)

#### Attempt 20f79db0-dfa8-4a4b-8044-3bbfe6447545

completed · 时间: 2026-09-08T06:09:51.117Z · 首次 Attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-20f79db0-dfa8-4a4b-8044-3bbfe6447545"></a>

<details><summary>查看模型原始回答</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"Replit","domain":null,"recommendation":"positive","mentionQuote":"Replit is a popular online IDE that supports multiple programming languages.","recommendationQuote":"I recommend Replit for its user-friendly interface and collaborative features.","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"CodeSandbox","domain":null,"recommendation":"positive","mentionQuote":"CodeSandbox is another excellent online IDE for web development.","recommendationQuote":"CodeSandbox is highly recommended for its integration with GitHub and easy deployment.","firstMentionOffset":66,"firstRecommendationOffset":66,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Glitch","domain":null,"recommendation":"mentioned","mentionQuote":"Glitch allows you to create and share web applications easily.","recommendationQuote":null,"firstMentionOffset":134,"firstRecommendationOffset":null,"firstMentionState":"unique","firstRecommendationState":"none"},{"name":"Gitpod","domain":null,"recommendation":"mentioned","mentionQuote":"Gitpod provides a cloud-based development environment.","recommendationQuote":null,"firstMentionOffset":174,"firstRecommendationOffset":null,"firstMentionState":"unique","firstRecommendationState":"none"}],"unknowns":[]}</pre>

</details>

SHA-256: `277db6c41e6c3678239ab5ac84281507ecc43d8ad28444a9399364b564dd7e49`

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

此 Attempt 未归档正文 URL。

### online IDE · openai/gpt-4.1-mini

keywordId: watch-keyword-d5dd24e84cf2cc4e4cb01f22 · runId: 6a903d55-4c70-4e36-85c0-7742811d3f39 · probeId: 9e61a9be-8a5c-4c7e-a138-93197568c8eb

provider_native · failed · firstAttemptId: 53e4c750-3425-47aa-87c1-a07b110ab764

analysisStatus: analysis_failed · resultAttemptId: 53e4c750-3425-47aa-87c1-a07b110ab764

- mentionJudgment: unknown
- recommendationJudgment: unknown


无法确认: Unterminated string in JSON at position 4201 (line 1 column 4202)

[实际请求与原文证据](./public-evidence.json)

#### Attempt 53e4c750-3425-47aa-87c1-a07b110ab764

analysis_failed · 时间: 2026-09-08T06:09:47.861Z · 首次 Attempt

requestedSearch: provider_native · used: true · executionMode: native

OpenRouter metadata confirmed provider-native web search.

错误: analysis_failed · Unterminated string in JSON at position 4201 (line 1 column 4202)

finish_reason: stop

<a id="attempt-53e4c750-3425-47aa-87c1-a07b110ab764"></a>

<details><summary>查看模型原始回答</summary>

<pre>{"analysisStatus":"completed","mentions":[{"name":"Online IDE","domain":"online-ide.com","recommendation":"positive","mentionQuote":"\"Online IDE is a web-based tool powered by ACE code editor.\"","recommendationQuote":"\"This tool can be used to learn, build, run, test your program.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Total.codes","domain":"total.codes","recommendation":"positive","mentionQuote":"\"A fast online IDE for popular languages with built-in AI help, instant launch, and zero friction.\"","recommendationQuote":"\"Start coding without registration fees, hidden charges, or forced verification friction.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"OAHelper","domain":"oahelper.in","recommendation":"positive","mentionQuote":"\"OAHelper Online IDE is a free, browser-based code editor and compiler.\"","recommendationQuote":"\"Write and execute C++, Python, Java, JavaScript, SQL, PostgreSQL and Bash without installing anything.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Codeground AI","domain":"codeground.ai","recommendation":"positive","mentionQuote":"\"Codeground AI is the all-in-one developer platform.\"","recommendationQuote":"\"Spin up cloud workspaces, run code in 15+ languages, conduct secure technical interviews and use a complete developer toolbox — all from a single browser tab.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"HashIDEA","domain":"hashideea.com","recommendation":"positive","mentionQuote":"\"HashIDEA is a free, open-source online code editor that runs entirely in your browser.\"","recommendationQuote":"\"Write React, Python, JavaScript, and TypeScript code with live preview, npm package support, and instant sharing via URL.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"myCompiler","domain":"mycompiler.io","recommendation":"positive","mentionQuote":"\"myCompiler is an online IDE for C, C++, Java, Python, Go, NodeJS and other languages.\"","recommendationQuote":"\"Edit, compile and run code online with myCompiler. No setup needed.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"PyTogether","domain":"pytogether.org","recommendation":"positive","mentionQuote":"\"PyTogether is a free &amp; open-source, zero-setup, real-time collaborative online Python IDE &amp; editor.\"","recommendationQuote":"\"Built for pair programming, interviews, learning, and teaching. Code, communicate, draw, and run Python directly in your browser.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"pythoncompiler.io","domain":"pythoncompiler.io","recommendation":"positive","mentionQuote":"\"pythoncompiler.io is a free online Python IDE, code editor, and interactive notebook that runs entirely in your browser.\"","recommendationQuote":"\"Write Python, run it instantly, explore data with Pandas, compute with NumPy, visualize with Matplotlib, and share everything with a single link — all without installing a single package on your computer.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"Picode","domain":"picode.bunnode.com","recommendation":"positive","mentionQuote":"\"Picode is the #1 online compiler for 20+ programming languages with integrated AI assistance.\"","recommendationQuote":"\"Run Python, JavaScript, C++, Rust, Go, Java, PHP, TypeScript, and more directly in your browser with zero installation required.\"","firstMentionOffset":0,"firstRecommendationOffset":0,"firstMentionState":"unique","firstRecommendationState":"unique"},{"name":"PyForm","domain":"pyform.dev","recommendation":"positive","mentionQuote":"\"PyForm runs entirely in your browser — no installs</pre>

</details>

SHA-256: `5beebf120a3c841717f51750d119e2a003a99f5a357fc73c95dd2eec3e5fcc7d`

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

此 Attempt 未归档正文 URL。

### online IDE · google/gemini-2.5-flash-lite

keywordId: watch-keyword-d5dd24e84cf2cc4e4cb01f22 · runId: 6a903d55-4c70-4e36-85c0-7742811d3f39 · probeId: 241399ec-02a4-4e09-b5ad-96aa438e534e

off · completed · firstAttemptId: 25f23ef4-e5f1-4297-a710-43d18eae76e2

analysisStatus: completed · resultAttemptId: 25f23ef4-e5f1-4297-a710-43d18eae76e2

- mentionJudgment: adjudicable
- recommendationJudgment: adjudicable

- online IDE: mentioned · mention: online IDE · recommendation: — · attemptId: 25f23ef4-e5f1-4297-a710-43d18eae76e2

无法确认: —

[实际请求与原文证据](./public-evidence.json)

#### Attempt 25f23ef4-e5f1-4297-a710-43d18eae76e2

completed · 时间: 2026-09-08T06:09:43.961Z · 首次 Attempt

requestedSearch: off · used: false · executionMode: unverified

finish_reason: stop

<a id="attempt-25f23ef4-e5f1-4297-a710-43d18eae76e2"></a>

<details><summary>查看模型原始回答</summary>

<pre>{
  "analysisStatus": "completed",
  "mentions": [
    {
      "name": "online IDE",
      "domain": null,
      "recommendation": "mentioned",
      "mentionQuote": "online IDE",
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

SHA-256: `4991b86a24c776eabfd66c04b8e2475653a59a0558c9a48599d228a0a0079679`

#### Provider 引用

此 Attempt 未归档此类来源。

#### 搜索检索结果

此 Attempt 未归档此类来源。

#### 回答中的链接（非 Provider 引用）

此 Attempt 未归档正文 URL。

## 重复观察

1 次归档测量运行；数量不表示全部成功。只比较相同模型、语言、搜索与指纹条件。短期重复不代表长期趋势或因果效果。

- Run 6a903d55-4c70-4e36-85c0-7742811d3f39: partial

- D e9e4d405-77b2-4107-b4ac-9b5d367282f4 · openai/gpt-4o-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: e9ec39c3-a3fe-4d9d-8011-b736b85bb8e2 · resultAttemptId: e9ec39c3-a3fe-4d9d-8011-b736b85bb8e2
- D 493aca38-32e3-40e8-afb1-757674f8dd6c · openai/gpt-4.1-mini · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: ebb330f9-e513-42e9-9f59-ca4adbcba9ca · resultAttemptId: ebb330f9-e513-42e9-9f59-ca4adbcba9ca
- D 6b6301f5-be52-4799-8890-06f6b0b8b139 · google/gemini-2.5-flash-lite · domainRecognition: recognized · analysisStatus: recognized · firstAttemptId: 89618a0f-152d-48b6-b168-3c492a31f219 · resultAttemptId: 89618a0f-152d-48b6-b168-3c492a31f219

## 产品截图

![replit.com：原始回答及来源类别](../../../assets/screenshots/v0.2.0-rc.1/R10-answers.png)

R10 · replit.com · D · 3 条归档尝试 · openai/gpt-4o-mini（off）、google/gemini-2.5-flash-lite（off）、openai/gpt-4.1-mini（provider_native） · 2026-09-08T06:09:26.484Z 至 2026-09-08T06:09:26.484Z。保留原始失败状态。

截图时间: 2026-09-08T07:19:05.630Z.

<details><summary>历史页面：当时页面展示，排名未通过核验</summary>

当时页面展示，排名未通过核验。图片与原始 Hash 保留，不能据图确定第一名。

![replit.com：实际中性关键词测量](../../../assets/screenshots/v0.2.0-rc.1/R10-keywords.png)

R10 · replit.com · D/K · 6 条归档尝试 · openai/gpt-4o-mini（off）、google/gemini-2.5-flash-lite（off）、openai/gpt-4.1-mini（provider_native） · 2026-09-08T06:09:40.567Z 至 2026-09-08T06:09:43.961Z。保留原始失败状态。

截图时间: 2026-09-08T07:19:05.933Z.

</details>

## 复核与重新测量

[案例配置](./case.json) · [证据索引](./evidence-index.json) · [公开证据包](./public-evidence.json)

SHA-256: `76c8a46b2bf0ab55c44a80bb6c73d5f3ce4cd16094cfbc9091a92d801076a166`

历史案例费用（非本轮文档费用）: USD 0.04524405 · 9 次调用 · 33778 Token.

[导出源码](../../../examples/lib/export.mjs) · [候选版本与未发布状态](../../../docs/releases/v0.2.0-rc.1.md)

```bash
npm run examples:plan -- --case R10
npm run examples:replay -- --case R10 --evidence examples/cases/R10/public-evidence.json
```

重新测量会收费：必须使用独立产品服务、冻结计划和显式 live 授权。阅读或导出不调用模型。

## 限制与披露

仅作公开产品观察；收录不表示合作或背书关系。

模型描述不是已核实的市场事实。来源存在不证明页面内容正确，也不说明为何推荐。未知、缺失、解析失败与请求失败保持区分。可据此调查业务误述或来源内容，但不能断言差距由某次优化造成。

- Run 6a903d55-4c70-4e36-85c0-7742811d3f39: partial
- Probe 9e61a9be-8a5c-4c7e-a138-93197568c8eb: failed; first attempt analysis_failed
- Probe 9e61a9be-8a5c-4c7e-a138-93197568c8eb: missing or failed analysis
- Attempt 53e4c750-3425-47aa-87c1-a07b110ab764: analysis_failed; Unterminated string in JSON at position 4201 (line 1 column 4202)
