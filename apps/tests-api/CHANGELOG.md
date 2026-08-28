# [1.1.0](https://github.com/dauntless-arcane/Competency-Mapping/compare/frontend-v1.0.0...frontend-v1.1.0) (2025-10-30)


### Bug Fixes

* /api/users/fetch-tests to added  level,duration,recommended ([e96d9f2](https://github.com/dauntless-arcane/Competency-Mapping/commit/e96d9f29787bea87b7fa4eee2a6d987282c8240b))
* add --legacy-peer-deps flag to @semantic-release/release-notes-generator installation ([5e68f56](https://github.com/dauntless-arcane/Competency-Mapping/commit/5e68f56320f59b9217fa3cd81587e93e1de14606))
* mongodb_atlas_db_uri_with_credentials in file fixed ([87225b6](https://github.com/dauntless-arcane/Competency-Mapping/commit/87225b6b6518d36672ebc0564b67db0767991380))
* name not coming in /api/users/fetch-tests/ ([de68eb0](https://github.com/dauntless-arcane/Competency-Mapping/commit/de68eb0f3ce59991e048a7e7ab476abd9429bb31))
* regenerate package-lock.json with legacy peer deps ([0cee040](https://github.com/dauntless-arcane/Competency-Mapping/commit/0cee0408d03db76a38d59768c4a6de36195ce533))
* **result-generator:** add missing mongoose import and update survey response with scores ([b834907](https://github.com/dauntless-arcane/Competency-Mapping/commit/b83490712d63b9f81d6baec612d995cd602abb93))
* **result-generator:** add missing mongoose import and update survey response with scores ([0ce93c0](https://github.com/dauntless-arcane/Competency-Mapping/commit/0ce93c0d8e562a1e387d60e3efdf97c71c1d32db))
* standardize quotes in frontend release workflow ([6bedced](https://github.com/dauntless-arcane/Competency-Mapping/commit/6bedcedb04a3333f9aaa93533f7720058b7c9799))
* the result fetch giving null for all rrsponses ([674c0f7](https://github.com/dauntless-arcane/Competency-Mapping/commit/674c0f75467f8d2218280de6d0ff9cf1eb1890ae))
* wrong status code sent ([f8ad45f](https://github.com/dauntless-arcane/Competency-Mapping/commit/f8ad45ff70f6b0f0e5dc87f7725024287ab7476f))


### Features

* add @semantic-release/changelog dependency to package.json and package-lock.json ([8791a32](https://github.com/dauntless-arcane/Competency-Mapping/commit/8791a3256b987f97a56f2700e1bdccc58a2f46b4))
* add @semantic-release/exec dependency to package.json and package-lock.json ([13fb67a](https://github.com/dauntless-arcane/Competency-Mapping/commit/13fb67ae10110ff0fce62482ffed5ba13a772852))
* added Login>js and fixed api for the user-survey ([907bb15](https://github.com/dauntless-arcane/Competency-Mapping/commit/907bb15b5920e72b2821a610ba8b2d09e6083117))
* added the saving api for saving data of users to DB ([76076c7](https://github.com/dauntless-arcane/Competency-Mapping/commit/76076c7888702349d105dc7aafed1166571bbf8d))
* **api:** add categoryConstants support in test creation route ([67356d6](https://github.com/dauntless-arcane/Competency-Mapping/commit/67356d6f21c7d78adf33272b0baaa75afdc51c61))
* backend release automation file added ([08434f9](https://github.com/dauntless-arcane/Competency-Mapping/commit/08434f972dac95d69608f18bf9ed0a901639253f))
* **release:** add frontend release workflow configuration ([b0fdc65](https://github.com/dauntless-arcane/Competency-Mapping/commit/b0fdc6574c846a293d28ec901666477f538c0282))
* **release:** add frontend release workflow with semantic-release configuration ([41f1061](https://github.com/dauntless-arcane/Competency-Mapping/commit/41f1061b169dc12e7a43736ceddb779014b9ebb7))
* **survey:** Implement automatic result generation on submission ([5a455c3](https://github.com/dauntless-arcane/Competency-Mapping/commit/5a455c3ba4f0f7da60c2d444649992d76ba7ac55))
* **survey:** integrate framer-motion for smooth question transitions and update validation schema ([0f46ddd](https://github.com/dauntless-arcane/Competency-Mapping/commit/0f46ddd236580dc7542b48b414d0062efc029b2a))
* **watcher:** process pending survey responses and auto-generate results ([79f02ab](https://github.com/dauntless-arcane/Competency-Mapping/commit/79f02abf78ceb37c1b74db50a7a2235288e06d09))


### BREAKING CHANGES

* **survey:** The payload for `POST /api/users/entry` has changed. The `ans` field is no longer a generic object and must now be an array of objects, each with a `questionId` (string) and `value` (number).
