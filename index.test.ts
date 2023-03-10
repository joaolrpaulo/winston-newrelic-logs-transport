import WinstonNewrelicLogsTransport from "index";
import { beforeAll, expect, test, vi } from "vitest";
import { LEVEL, MESSAGE } from "triple-beam";
import axios, { AxiosInstance } from "axios";

vi.useFakeTimers();

const axiosCreateSpy = vi.spyOn(axios, "create");

const mockPost = vi.fn();
const mockAxiosClient = {
  post: mockPost,
} as Partial<AxiosInstance> as AxiosInstance;

beforeAll(() => {
  axiosCreateSpy.mockReturnValue(mockAxiosClient);

  mockPost.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        console.log("resolving");

        setImmediate(() => {
          console.log("resolved");

          resolve();
        });
      })
  );
});

test("should post and fire callback", async () => {
  const transport = new WinstonNewrelicLogsTransport({
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
      "X-License-Key": "000000",
    },
    timeout: 123456,
  });

  const cb = vi.fn();

  transport.log({ [MESSAGE]: "Some message", [LEVEL]: "info" }, cb);

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

  await vi.runAllTimersAsync();
  expect(cb).toHaveBeenCalledWith(err);
  expect(errorEventHandler).toHaveBeenCalledWith(err);
});
