import { copyToClipboard } from './app/lib/clipboard.ts';
import { calculateAdjacentMines, isValidRevealBatch } from './app/lib/game-logic.ts';

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
    const board = { mine_positions: [] };
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, board, boardSize);
    assert(count === 0, 'Center cell with no mines should return 0');
  }

  // Test 5: calculateAdjacentMines - Center cell with 1 mine
  {
    const board = { mine_positions: [{ r: 1, c: 1 }] };
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, board, boardSize);
    assert(count === 1, 'Center cell with 1 adjacent mine should return 1');
  }

  // Test 6: calculateAdjacentMines - Center cell with 8 mines
  {
    const board = { mine_positions: [
      { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 },
      { r: 2, c: 1 },                 { r: 2, c: 3 },
      { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 3, c: 3 }
    ] };
    const boardSize = 5;
    const count = calculateAdjacentMines(2, 2, board, boardSize);
    assert(count === 8, 'Center cell with 8 adjacent mines should return 8');
  }

  // Test 7: calculateAdjacentMines - Corner cell (top-left) with 3 mines
  {
    const board = { mine_positions: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] };
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 0, board, boardSize);
    assert(count === 3, 'Top-left corner cell with 3 adjacent mines should return 3');
  }

  // Test 8: calculateAdjacentMines - Corner cell (bottom-right) with 3 mines
  {
    const board = { mine_positions: [{ r: 3, c: 4 }, { r: 4, c: 3 }, { r: 3, c: 3 }] };
    const boardSize = 5;
    const count = calculateAdjacentMines(4, 4, board, boardSize);
    assert(count === 3, 'Bottom-right corner cell with 3 adjacent mines should return 3');
  }

  // Test 9: calculateAdjacentMines - Edge cell with 5 mines
  {
    const board = { mine_positions: [
      { r: 0, c: 1 },                 { r: 0, c: 3 },
      { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }
    ] };
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 2, board, boardSize);
    assert(count === 5, 'Top edge cell with 5 adjacent mines should return 5');
  }

  // Test 10: calculateAdjacentMines - Mines outside bounds are ignored
  {
    const board = { mine_positions: [{ r: -1, c: 0 }, { r: 0, c: -1 }, { r: 5, c: 4 }] };
    const boardSize = 5;
    const count = calculateAdjacentMines(0, 0, board, boardSize);
    assert(count === 0, 'Mines outside bounds should not be counted');
  }

  // Test 11: isValidRevealBatch - a single safe cell is always valid, mine-adjacent or not
  {
    const mines = [{ r: 1, c: 1 }];
    const valid = isValidRevealBatch([{ r: 0, c: 0 }], mines, 3, new Set());
    assert(valid === true, 'A lone revealed cell should always be a valid batch');
  }

  // Test 12: isValidRevealBatch - full-board cascade on an empty (mine-free) board is valid
  {
    const boardSize = 3;
    const allCells = [];
    for (let r = 0; r < boardSize; r++) for (let c = 0; c < boardSize; c++) allCells.push({ r, c });
    const valid = isValidRevealBatch(allCells, [], boardSize, new Set());
    assert(valid === true, 'A full-board cascade from a single zero-mine cell should be valid');
  }

  // Test 13: isValidRevealBatch - a cascade missing a cell it should have included is rejected
  {
    const boardSize = 3;
    const allCells = [];
    for (let r = 0; r < boardSize; r++) for (let c = 0; c < boardSize; c++) allCells.push({ r, c });
    const incomplete = allCells.slice(0, -1); // drop the last cell
    const valid = isValidRevealBatch(incomplete, [], boardSize, new Set());
    assert(valid === false, 'A cascade missing a cell the flood-fill would have reached should be rejected');
  }

  // Test 14: isValidRevealBatch - already-revealed cells act as a boundary, not part of a new cascade
  {
    const boardSize = 3;
    const alreadyRevealed = new Set(['1,1']);
    const expected = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (r === 1 && c === 1) continue;
        expected.push({ r, c });
      }
    }
    const valid = isValidRevealBatch(expected, [], boardSize, alreadyRevealed);
    assert(valid === true, 'A cascade should be able to flow around already-revealed cells');

    const withStaleCell = [...expected, { r: 1, c: 1 }];
    const invalid = isValidRevealBatch(withStaleCell, [], boardSize, alreadyRevealed);
    assert(invalid === false, 'Resubmitting an already-revealed cell as part of a new cascade should be rejected');
  }

  // Test 15: isValidRevealBatch - two disjoint single-cell reveals stitched into one batch are rejected
  {
    // Center mine means every other cell in a 3x3 board has 1 adjacent mine
    // (never 0), so no real click can ever cascade to more than one cell.
    const mines = [{ r: 1, c: 1 }];
    const stitched = [{ r: 0, c: 0 }, { r: 2, c: 2 }];
    const valid = isValidRevealBatch(stitched, mines, 3, new Set());
    assert(valid === false, 'Two unrelated single-cell reveals batched together should be rejected');
  }

  // Test 16: isValidRevealBatch - a duplicate cell within the same batch is rejected
  {
    const valid = isValidRevealBatch([{ r: 0, c: 0 }, { r: 0, c: 0 }], [], 3, new Set());
    assert(valid === false, 'A batch with a duplicate cell should be rejected');
  }

  console.log(`\nTests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
