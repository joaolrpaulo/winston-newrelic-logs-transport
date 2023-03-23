import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import TransportStream from "winston-transport";
import throttle from "lodash.throttle";
import cloneDeep from "lodash.clonedeep";

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

type LogDataType = Record<string | symbol, string>;

export const defaultBatchSize = 100;
export const defaultBatchThrottle = 1000;

/**
 * Transport for reporting errors to newrelic.
 *
 * @type {WinstonNewrelicLogsTransport}
 * @augments {TransportStream}
 */
export default class WinstonNewrelicLogsTransport extends TransportStream {
  private axiosClient: AxiosInstance;
  private logs: LogDataType[];
  public readonly batchSize?: number;
  public readonly batchThrottle?: number;
  private readonly throttledBatchPost: ReturnType<typeof throttle> | undefined;

  /**
   * A lot of the implementation seen here is based around the loggly modules for winston.
   * https://github.com/loggly/winston-loggly-bulk
   * https://github.com/loggly/node-loggly-bulk
   */

  /**
   * Contrusctor for the WinstonNewrelicLogsTransport.
   *
   * @param options - Options.
   */
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

  /**
   * Performs the batch posting operations.
   */
  private batchPost() {
    try {
      const logs = this.logs.slice();
      this.logs = [];

      const data = [
        {
          logs,
        },
      ];

      this.axiosClient
        .post("/log/v1", data)
        .then(() => {
          for (const log of logs) {
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

  /**
   * Logs data to Newrelic either directly or via batching as configured.
   *
   * @param data - Info to log.
   * @param callback - Logging callback.
   */
  public log(data: LogDataType, callback: (error?: Error | null) => void) {
    // The implementation of log callbacks isn't documented and the exported type
    // definitions appear to be wrong too. This implementation has been compied
    // https://github.com/winstonjs/winston-mongodb/blob/master/lib/winston-mongodb.js#L229-L235
    // However I don't know what the second argument for callback is supposed to
    // indicate.

    const entry = validateData(data);

    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    if (this.throttledBatchPost && this.batchSize && this.batchSize > 0) {
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

/**
 * Checks the incoming meta data and makes it safe for sending.
 *
 * @param data - Data to check.
 * @returns Checked and cloned data.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function validateData(data: LogDataType): LogDataType {
  if (data === null) {
    return {};
  } else if (typeof data !== "object") {
    return { metadata: data };
  } else {
    return cloneDeep(data);
  }
}
