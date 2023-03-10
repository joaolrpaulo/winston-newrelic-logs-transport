import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import TransportStream from "winston-transport";
import { LEVEL, MESSAGE } from "triple-beam";

export interface WinstonNewrelicLogsTransportOptions {
  licenseKey: string;
  apiUrl: string;
  axiosOptions?: AxiosRequestConfig;
}

/**
 * Transport for reporting errors to newrelic.
 * 
 * @type {WinstonNewrelicLogsTransport}
 * @extends {TransportStream}
 */
export default class WinstonNewrelicLogsTransport extends TransportStream {
  axiosClient: AxiosInstance;

  constructor(options: WinstonNewrelicLogsTransportOptions) {
    super();

    this.axiosClient = axios.create({
      timeout: 5000,
      ...options.axiosOptions,
      baseURL: options.apiUrl,
      headers: {
        ...options.axiosOptions?.headers,
        "X-License-Key": options.licenseKey,
        "Content-Type": "application/json",
      },
    });
  }

  log(info: { [x in symbol]: string }, callback: (error?: Error) => void) {
    // The implementation of log callbacks isn't documented and the exported type
    // definitions appear to be wrong too. This implementation has been compied
    // https://github.com/winstonjs/winston-mongodb/blob/master/lib/winston-mongodb.js#L229-L235
    // However I don't know what the second argument for callback is supposed to 
    // indicate.

    this.axiosClient
      .post("/log/v1", {
        timestamp: Date.now(),
        message: info[MESSAGE],
        logtype: info[LEVEL],
      })
      .then(() => {
        this.emit("logged", info);
        callback(null);
      })
      .catch((err) => {
        this.emit("error", err);
        callback(err);
      });
  }
}
