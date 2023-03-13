import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import TransportStream from "winston-transport";
import { LEVEL, MESSAGE } from "triple-beam";
import throttle from "lodash.throttle";

export interface WinstonNewrelicLogsTransportOptions {
  /**
   * Your NewRelic key.
   *
   * @see https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/#auth-header.
   */
  licenseKey: string;
  /**
   * The URL to send data to.
   *
   * @see https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/#endpoint.
   */
  apiUrl: string;
  /**
   * Options to use when sending data via Axios.
   */
  axiosOptions?: AxiosRequestConfig;
  /**
   * How many log items you would like to bundle together before posting to loggly.
   */
  batchSize?: number | true;
  /**
   * The maximum frequency the batch posting should occur unless the batch size is exceeded.
   */
  batchThrottle?: number | true;
}

interface LogEntry {
  timestamp: number;
  message: string;
  logtype: string;
}

export const defaultBatchSize = 100;
export const defaultBatchThrottle = 1000;

/**
 * Transport for reporting errors to newrelic.
 *
 * @type {WinstonNewrelicLogsTransport}
 * @extends {TransportStream}
 */
export default class WinstonNewrelicLogsTransport extends TransportStream {
  private axiosClient: AxiosInstance;
  private logs: LogEntry[];
  public readonly batchSize?: number;
  public readonly batchThrottle?: number;
  private readonly throttledBatchPost: ReturnType<typeof throttle> | undefined;

  constructor(options: WinstonNewrelicLogsTransportOptions) {
    super();

    this.logs = [];
    this.axiosClient = axios.create({
      timeout: 5000,
      ...options.axiosOptions,
      baseURL: options.apiUrl,
      headers: {
        ...options.axiosOptions?.headers,
        "Api-Key": options.licenseKey,
        "Content-Type": "application/json",
      },
    });

    if (
      options.batchSize !== undefined ||
      options.batchThrottle !== undefined
    ) {
      this.batchSize =
        options.batchSize === true
          ? defaultBatchSize
          : options.batchSize ?? defaultBatchSize;
      this.batchThrottle =
        options.batchThrottle === true
          ? defaultBatchThrottle
          : options.batchThrottle ?? defaultBatchThrottle;

      if (this.batchSize <= 0) {
        throw new Error("Expected a batchSize greater than 0");
      }
      if (this.batchThrottle <= 0) {
        throw new Error("Expected a batchThrottle greater than 0");
      }

      this.throttledBatchPost = throttle(
        this.batchPost.bind(this),
        this.batchThrottle,
        { leading: false, trailing: true }
      );
    }
  }

  private batchPost() {
    try {
      const toSend = this.logs.slice();
      this.logs = [];

      this.axiosClient
        .post("/log/v1", {
          logs: toSend,
        })
        .then(() => {
          for (const log of toSend) {
            this.emit("logged", log);
          }
        })
        .catch((err) => {
          this.emit("error", err);
        });
    } catch (err) {
      this.emit("error", err);
    }
  }

  public log(
    info: { [x in symbol]: string },
    callback: (error?: Error | null) => void
  ) {
    // The implementation of log callbacks isn't documented and the exported type
    // definitions appear to be wrong too. This implementation has been compied
    // https://github.com/winstonjs/winston-mongodb/blob/master/lib/winston-mongodb.js#L229-L235
    // However I don't know what the second argument for callback is supposed to
    // indicate.

    const entry: LogEntry = {
      timestamp: Date.now(),
      message: info[MESSAGE],
      logtype: info[LEVEL],
    };

    if (this.throttledBatchPost) {
      this.logs.push(entry);
      this.throttledBatchPost();

      if (this.logs.length >= this.batchSize) {
        this.throttledBatchPost.flush();
      }

      callback(null);
    } else {
      this.axiosClient
        .post("/log/v1", entry)
        .then(() => {
          this.emit("logged", entry);
          callback(null);
        })
        .catch((err) => {
          this.emit("error", err);
          callback(err);
        });
    }
  }
}
