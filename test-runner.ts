import { copyToClipboard } from './app/lib/clipboard.ts';
import { calculateAdjacentMines } from './app/lib/game-logic.ts';

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


  // Test 4: calculateAdjacentMines - Center cell with no mines
  {
    const minePositionsSet = new Set<string>();
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, minePositionsSet, boardSize);
    assert(count === 0, 'Center cell with no mines should return 0');
  }

  // Test 5: calculateAdjacentMines - Center cell with 1 mine
  {
    const minePositionsSet = new Set<string>(['1,1']);
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, minePositionsSet, boardSize);
    assert(count === 1, 'Center cell with 1 adjacent mine should return 1');
  }

  // Test 6: calculateAdjacentMines - Center cell with 8 mines
  {
    const minePositionsSet = new Set<string>([
      '1,1', '1,2', '1,3',
      '2,1',        '2,3',
      '3,1', '3,2', '3,3'
    ]);
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, minePositionsSet, boardSize);
    assert(count === 8, 'Center cell with 8 adjacent mines should return 8');
  }

  // Test 7: calculateAdjacentMines - Corner cell (top-left) with 3 mines
  {
    const minePositionsSet = new Set<string>(['0,1', '1,0', '1,1']);
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 0, minePositionsSet, boardSize);
    assert(count === 3, 'Top-left corner cell with 3 adjacent mines should return 3');
  }

  // Test 8: calculateAdjacentMines - Corner cell (bottom-right) with 3 mines
  {
    const minePositionsSet = new Set<string>(['3,4', '4,3', '3,3']);
    const boardSize = 5;
    const count = calculateAdjacentMines(4, 4, minePositionsSet, boardSize);
    assert(count === 3, 'Bottom-right corner cell with 3 adjacent mines should return 3');
  }

  // Test 9: calculateAdjacentMines - Edge cell with 5 mines
  {
    const minePositionsSet = new Set<string>([
      '0,1',        '0,3',
      '1,1', '1,2', '1,3'
    ]);
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 2, minePositionsSet, boardSize);
    assert(count === 5, 'Top edge cell with 5 adjacent mines should return 5');
  }

  // Test 10: calculateAdjacentMines - Mines outside bounds are ignored
  {
    const minePositionsSet = new Set<string>(['-1,0', '0,-1', '5,4']);
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 0, minePositionsSet, boardSize);
    assert(count === 0, 'Mines outside bounds should not be counted');
  }

  console.log(`\nTests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
