import WinstonNewrelicLogsTransport from "index";
import { expect, test, vi } from "vitest";
import { LEVEL, MESSAGE } from "triple-beam";

/**
 * READ ME!!
 * 
 * This is a simple integration tests but it requires a NewRelic account and manual validation
 * to check. If you want to run these tests you must
 * 
 * 1. Uncomment the marked line from vitest.config.ts
 * 2. Run with the command `KEY=YOUR_KEY yarn test integration`
 * 
 * It will write 51 log entries to NewRelic, make sure they're there. 
 */

const licenseKey = process.env.KEY;

const errorEventHandler = vi.fn();
const loggedEventHandler = vi.fn();
const cb = vi.fn();

test("should send data single", async () => {
  const transport = new WinstonNewrelicLogsTransport({
    apiUrl: "https://log-api.newrelic.com",
    licenseKey,
  });
  transport.on('error', errorEventHandler);
  transport.on('logged', loggedEventHandler);

  transport.log({
    [LEVEL]: "info",
    [MESSAGE]: "test integration single",
  }, cb);

  await new Promise((resolve) => {
    setTimeout(resolve, 5000);
  })

  expect(cb).toHaveBeenCalledWith(null);
  expect(errorEventHandler).not.toHaveBeenCalled();
  expect(loggedEventHandler).toHaveBeenCalledTimes(1);
});

test("should send data batch", async () => {
  const transport = new WinstonNewrelicLogsTransport({
    apiUrl: "https://log-api.newrelic.com",
    licenseKey,
    batchThrottle: 1000
  });
  transport.on('error', errorEventHandler);
  transport.on('logged', loggedEventHandler);

  for (let i = 0; i < 50; i++) {
    transport.log({
      [LEVEL]: "info",
      [MESSAGE]: `test integration ${i + 1}`,
    }, cb);
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 5000);
  })

  expect(cb).toHaveBeenCalledWith(null);
  expect(errorEventHandler).not.toHaveBeenCalled();
  expect(loggedEventHandler).toHaveBeenCalledTimes(50);
});
