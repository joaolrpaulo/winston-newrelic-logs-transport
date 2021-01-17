import axios, { AxiosInstance } from 'axios';
import TransportStream from 'winston-transport';
import { LEVEL, MESSAGE } from 'triple-beam';

/**
 * Transport for reporting errors to newrelic.
 * @type {Newrelic}
 * @extends {TransportStream}
 */
export default class Newrelic extends TransportStream {
    axiosClient: AxiosInstance;

    constructor(options = { licenseKey: '', apiUrl: '' }) {
        super();

        this.axiosClient = axios.create({
            baseURL: options.apiUrl,
            timeout: 5000,
            headers: {
                'X-License-Key': options.licenseKey,
                'Content-Type': 'application/json'
            }
        });
    }

    log(info: { [x in symbol]: string; }, callback: () => void) {
        setImmediate(() => this.emit('logged', info));

        this.axiosClient.post('/log/v1', {
            timestamp: Date.now(),
            message: info[MESSAGE],
            logtype: info[LEVEL]
        });

        callback();
    }
};