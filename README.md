# winston-newrelic-logs-transport

A [newrelic](http://newrelic.com/) Logs API transport for [winston](https://github.com/flatiron/winston).

## Installation

Tested on node-14.x.

``` sh
  $ npm install winston-newrelic-logs-transport --save
```

## Usage

```javascript
import { createLogger } from 'winston';
import WinstonNewrelicLogsTransport from 'winston-newrelic-logs-transport';
const logger = createLogger({
    transports: [
        new WinstonNewrelicLogsTransport({
            licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
            apiUrl: process.env.NEW_RELIC_API_URL,
        }),
    ],
});
```
## Options
* __licenseKey__: New Relic license key.
* __apiUrl__: New Relic Log Base API URL.
* __axiosOptions__: Options passed to Axios when sending data. (Optional)
* __batchSize__:  How many log items you would like to bundle together before posting to loggly. (Optional, positive integer or true, default 100)
* __batchThrottle__: The maximum frequency the batch posting should occur unless the batch size is exceeded. (Optional, positive integer or true, default 1000)

### Batching

If either batching option is set without the other, or simply set as `true` then default values are used as specified. 
