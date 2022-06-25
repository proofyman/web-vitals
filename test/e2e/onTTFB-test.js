/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'assert';
import {beaconCountIs, clearBeacons, getBeacons} from '../utils/beacons.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';


/**
 * Accepts a PerformanceNavigationTimingEntry (or shim) and asserts that it
 * has all the expected properties.
 * @param {Object} entry
 */
function assertValidEntry(entry) {
  const timingProps = [
    'connectEnd',
    'connectStart',
    'domComplete',
    'domContentLoadedEventEnd',
    'domContentLoadedEventStart',
    'domInteractive',
    'domainLookupEnd',
    'domainLookupStart',
    'fetchStart',
    'loadEventEnd',
    'loadEventStart',
    'redirectEnd',
    'redirectStart',
    'requestStart',
    'responseEnd',
    'responseStart',
    'secureConnectionStart',
    'startTime',
    'unloadEventEnd',
    'unloadEventStart',
  ];

  assert.strictEqual(entry.entryType, 'navigation');
  for (const timingProp of timingProps) {
    assert(entry[timingProp] >= 0);
  }
}

describe('onTTFB()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value when run during page load', async function() {
    await browser.url('/test/ttfb');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value when run after page load', async function() {
    await browser.url('/test/ttfb?awaitLoad=1');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('accounts for time prerendering the page', async function() {
    await browser.url('/test/ttfb?prerender=1');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.entries.length, 1);
    assert.strictEqual(ttfb.navigationType, 'prerender');
    assert.strictEqual(ttfb.value, Math.max(
        0, ttfb.entries[0].responseStart - ttfb.entries[0].activationStart));

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value when run while prerendering', async function() {
    // Use 500 so prerendering finishes before load but after the module runs.
    await browser.url('/test/ttfb?prerender=500&imgDelay=1000');

    const ttfb = await getTTFBBeacon();

    // Assert that prerendering finished after responseStart and before load.
    assert(ttfb.entries[0].activationStart >= ttfb.entries[0].responseStart);
    assert(ttfb.entries[0].activationStart <= ttfb.entries[0].loadEventEnd);

    assert(ttfb.value >= 0);
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.entries.length, 1);
    assert.strictEqual(ttfb.navigationType, 'prerender');
    assert.strictEqual(ttfb.value, Math.max(
        0, ttfb.entries[0].responseStart - ttfb.entries[0].activationStart));

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports after a bfcache restore', async function() {
    await browser.url('/test/ttfb');

    const ttfb1 = await getTTFBBeacon();

    assert(ttfb1.value >= 0);
    assert(ttfb1.value >= ttfb1.entries[0].requestStart);
    assert(ttfb1.value <= ttfb1.entries[0].loadEventEnd);
    assert(ttfb1.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb1.name, 'TTFB');
    assert.strictEqual(ttfb1.value, ttfb1.delta);
    assert.strictEqual(ttfb1.navigationType, 'navigate');
    assert.strictEqual(ttfb1.entries.length, 1);

    assertValidEntry(ttfb1.entries[0]);

    await clearBeacons();
    await stubForwardBack();

    const ttfb2 = await getTTFBBeacon();

    assert(ttfb2.value >= 0);
    assert(ttfb2.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb2.name, 'TTFB');
    assert.strictEqual(ttfb2.value, ttfb2.delta);
    assert.strictEqual(ttfb2.navigationType, 'back_forward_cache');
    assert.strictEqual(ttfb2.entries.length, 0);
  });

  describe('attribution', function() {
    it('includes attribution data on the metric object', async function() {
      await browser.url('/test/ttfb?attribution=1');

      const ttfb = await getTTFBBeacon();

      assert(ttfb.value >= 0);
      assert(ttfb.value >= ttfb.entries[0].requestStart);
      assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
      assert(ttfb.id.match(/^v2-\d+-\d+$/));
      assert.strictEqual(ttfb.name, 'TTFB');
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.navigationType, 'navigate');
      assert.strictEqual(ttfb.entries.length, 1);

      assertValidEntry(ttfb.entries[0]);

      const navEntry = ttfb.entries[0];
      assert.strictEqual(ttfb.attribution.waitingTime,
          navEntry.domainLookupStart);
      assert.strictEqual(ttfb.attribution.dnsTime,
          navEntry.connectStart - navEntry.domainLookupStart);
      assert.strictEqual(ttfb.attribution.connectionTime,
          navEntry.requestStart - navEntry.connectStart);
      assert.strictEqual(ttfb.attribution.requestTime,
          navEntry.responseStart - navEntry.requestStart);

      assert.deepEqual(ttfb.attribution.navigationEntry, navEntry);
    });

    it('accounts for time prerendering the page', async function() {
      await browser.url('/test/ttfb?attribution=1&prerender=1');

      const ttfb = await getTTFBBeacon();

      // Since this value is stubbed in the browser, get it separately.
      const activationStart = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].activationStart;
      });

      assert(ttfb.value >= 0);
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.entries.length, 1);
      assert.strictEqual(ttfb.navigationType, 'prerender');
      assert.strictEqual(ttfb.value,
          Math.max(0, ttfb.entries[0].responseStart - activationStart));

      assertValidEntry(ttfb.entries[0]);

      const navEntry = ttfb.entries[0];
      assert.strictEqual(ttfb.attribution.waitingTime,
          Math.max(0, navEntry.domainLookupStart - activationStart));
      assert.strictEqual(ttfb.attribution.dnsTime,
          Math.max(0, navEntry.connectStart - activationStart) -
          Math.max(0, navEntry.domainLookupStart - activationStart));
      assert.strictEqual(ttfb.attribution.connectionTime,
          Math.max(0, navEntry.requestStart - activationStart) -
          Math.max(0, navEntry.connectStart - activationStart));

      assert.strictEqual(ttfb.attribution.requestTime,
          Math.max(0, navEntry.responseStart - activationStart) -
          Math.max(0, navEntry.requestStart - activationStart));

      assert.deepEqual(ttfb.attribution.navigationEntry, navEntry);
    });

    it('reports after a bfcache restore', async function() {
      await browser.url('/test/ttfb?attribution=1');

      await getTTFBBeacon();

      await clearBeacons();
      await stubForwardBack();

      await beaconCountIs(1);

      const ttfb = await getTTFBBeacon();

      assert(ttfb.value >= 0);
      assert(ttfb.id.match(/^v2-\d+-\d+$/));
      assert.strictEqual(ttfb.name, 'TTFB');
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.navigationType, 'back_forward_cache');
      assert.strictEqual(ttfb.entries.length, 0);

      assert.strictEqual(ttfb.attribution.waitingTime, 0);
      assert.strictEqual(ttfb.attribution.dnsTime, 0);
      assert.strictEqual(ttfb.attribution.connectionTime, 0);
      assert.strictEqual(ttfb.attribution.requestTime, 0);
      assert.strictEqual(ttfb.attribution.navigationEntry, undefined);
    });
  });
});

const getTTFBBeacon = async () => {
  await beaconCountIs(1);
  const [ttfb] = await getBeacons();
  return ttfb;
};
