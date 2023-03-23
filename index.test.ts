import WinstonNewrelicLogsTransport, {
  defaultBatchSize,
  defaultBatchThrottle,
} from "index";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LEVEL, MESSAGE } from "triple-beam";
import axios, { AxiosInstance } from "axios";

vi.useFakeTimers();

const axiosCreateSpy = vi.spyOn(axios, "create");

const mockPost = vi.fn();
const mockAxiosClient = {
  post: mockPost,
} as Partial<AxiosInstance> as AxiosInstance;

beforeEach(() => {
  axiosCreateSpy.mockReturnValue(mockAxiosClient);

  mockPost.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        setImmediate(() => {
          resolve();
        });
      })
  );

  vi.clearAllTimers();
});

test("should setup axios", async () => {
  new WinstonNewrelicLogsTransport({
    apiUrl: "logs.foo.com",
    licenseKey: "000000",
    axiosOptions: {
      timeout: 123456,
    },
  });

  expect(axiosCreateSpy).toHaveBeenCalledTimes(1);
  expect(axiosCreateSpy).toHaveBeenCalledWith({
    baseURL: "logs.foo.com",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": "000000",
    },
    timeout: 123456,
  });
});

describe("single mode", () => {
  test("should post and fire callback", async () => {
    const transport = new WinstonNewrelicLogsTransport({
      apiUrl: "logs.foo.com",
      licenseKey: "000000",
      axiosOptions: {
        timeout: 123456,
      },
    });

    const cb = vi.fn();

    transport.log({ [MESSAGE]: "Some message", [LEVEL]: "info" }, cb);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/log/v1", {
      timestamp: expect.any(String),
      [MESSAGE]: "Some message",
      [LEVEL]: "info",
    });

    await vi.runAllTimersAsync();

    expect(cb).toHaveBeenCalledWith(null);
  });

  test("should handle errors", async () => {
    const errorEventHandler = vi.fn();

    const transport = new WinstonNewrelicLogsTransport({
      apiUrl: "logs.foo.com",
      licenseKey: "000000",
    });
    transport.on("error", errorEventHandler);

    const cb = vi.fn();

    const err = new Error("A timeout or something");
    mockPost.mockRejectedValue(err);

    transport.log({ [MESSAGE]: "Some message", [LEVEL]: "info" }, cb);

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledWith(err);
    expect(errorEventHandler).toHaveBeenCalledWith(err);
  });
});

describe("batch mode", () => {
  test("should throw with bad batch size", () => {
    expect(
      () =>
        new WinstonNewrelicLogsTransport({
          apiUrl: "logs.foo.com",
          licenseKey: "000000",
          batchSize: -1,
        })
    ).toThrowErrorMatchingInlineSnapshot(
      '"Expected a batchSize greater than 0"'
    );
  });

  test("should throw with bad throttle", () => {
    expect(
      () =>
        new WinstonNewrelicLogsTransport({
          apiUrl: "logs.foo.com",
          licenseKey: "000000",
          batchThrottle: -4000,
        })
    ).toThrowErrorMatchingInlineSnapshot(
      '"Expected a batchThrottle greater than 0"'
    );
  });

  test("should setup defaults", () => {
    const transport = new WinstonNewrelicLogsTransport({
      apiUrl: "logs.foo.com",
      licenseKey: "000000",
      batchThrottle: true,
    });

    expect(transport.batchSize).toEqual(defaultBatchSize);
    expect(transport.batchThrottle).toEqual(defaultBatchThrottle);
  });

  test("should batch send", async () => {
    const transport = new WinstonNewrelicLogsTransport({
      apiUrl: "logs.foo.com",
      licenseKey: "000000",
      batchThrottle: true,
    });

    const cb = vi.fn();

    for (let i = 0; i < 4; i++) {
      transport.log(
        { [MESSAGE]: `Some message ${i + 1}`, [LEVEL]: "info" },
        cb
      );
    }

    expect(mockPost).not.toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);

    expect(cb).toHaveBeenCalledWith(null);

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/log/v1", [
      {
        logs: [
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 1",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 2",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 3",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 4",
            [LEVEL]: "info",
          },
        ],
      },
    ]);
  });

  test("should batch send immediately if the size limit is breached", async () => {
    const transport = new WinstonNewrelicLogsTransport({
      apiUrl: "logs.foo.com",
      licenseKey: "000000",
      batchThrottle: true,
      batchSize: 3,
    });

    const cb = vi.fn();

    for (let i = 0; i < 5; i++) {
      transport.log(
        { [MESSAGE]: `Some message ${i + 1}`, [LEVEL]: "info" },
        cb
      );
    }

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][1][0].logs).toHaveLength(3);
    expect(mockPost).toHaveBeenCalledWith("/log/v1", [
      {
        logs: [
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 1",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 2",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 3",
            [LEVEL]: "info",
          },
        ],
      },
    ]);

    await vi.advanceTimersByTimeAsync(500);

    expect(cb).toHaveBeenCalledWith(null);

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1][1][0].logs).toHaveLength(2);
    expect(mockPost).toHaveBeenCalledWith("/log/v1", [
      {
        logs: [
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 4",
            [LEVEL]: "info",
          },
          {
            timestamp: expect.any(String),
            [MESSAGE]: "Some message 5",
            [LEVEL]: "info",
          },
        ],
      },
    ]);
  });
});
