import { copyToClipboard } from './app/lib/clipboard.ts';

async function runTests() {
  console.log('Running tests...');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ ${message}`);
      failed++;
    } else {
      console.log(`✅ ${message}`);
      passed++;
    }
  }

  try {
      Object.defineProperty(globalThis, 'navigator', {
          value: {},
          writable: true,
          configurable: true
      });
  } catch (e) {
      console.log('Could not redefine navigator', e);
  }

  type TimeoutCallback = () => void;

  // Test 1: Successful copy
  {
    let copiedState = false;
    let timeoutCb: TimeoutCallback | null = null;
    let writtenText = '';

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async (text: string) => {
            writtenText = text;
          }
        }
      },
      configurable: true
    });

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: TimeoutCallback) => {
      timeoutCb = cb;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof globalThis.setTimeout;

    await copyToClipboard('http://example.com', (val) => { copiedState = val; });

    assert(writtenText === 'http://example.com', 'Should write text to clipboard');
    assert(copiedState === (true as boolean), 'Should set copied to true');

    if (timeoutCb) (timeoutCb as TimeoutCallback)();
    assert(copiedState === (false as boolean), 'Should set copied to false after timeout');

    globalThis.setTimeout = originalSetTimeout;
  }

  // Test 2: navigator.clipboard is undefined
  {
    let copiedState = false;
    let timeoutCb: TimeoutCallback | null = null;

    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true
    });

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: TimeoutCallback) => {
      timeoutCb = cb;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof globalThis.setTimeout;

    await copyToClipboard('http://example.com', (val) => { copiedState = val; });

    assert(copiedState === (true as boolean), 'Should still set copied to true even if clipboard is missing');
    if (timeoutCb) (timeoutCb as TimeoutCallback)();
    assert(copiedState === (false as boolean), 'Should set copied to false after timeout');

    globalThis.setTimeout = originalSetTimeout;
  }

  // Test 3: writeText throws an error
  {
    let copiedState = false;
    let timeoutCb: TimeoutCallback | null = null;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('Not allowed');
          }
        }
      },
      configurable: true
    });

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: TimeoutCallback) => {
      timeoutCb = cb;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof globalThis.setTimeout;

    // Suppress console.error for this test
    const originalConsoleError = console.error;
    let errorLogged = false;
    console.error = () => { errorLogged = true; };

    await copyToClipboard('http://example.com', (val) => { copiedState = val; });

    assert(errorLogged, 'Should log error if writeText fails');
    assert(copiedState === (true as boolean), 'Should still set copied to true after failure');
    if (timeoutCb) (timeoutCb as TimeoutCallback)();
    assert(copiedState === (false as boolean), 'Should set copied to false after timeout');

    console.error = originalConsoleError;
    globalThis.setTimeout = originalSetTimeout;
  }

  console.log(`\nTests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
