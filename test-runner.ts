import { copyToClipboard } from './app/lib/clipboard.ts';
import { calculateAdjacentMines, isValidRevealBatch, buildAdjacencyGrid } from './app/lib/game-logic.ts';
import { rushDensity, rushMineCount, generateRushMines, summarizeRush, cascadeFrom, rushWinner, relocateMine, RUSH_BOARD_SIZE, RUSH_LIVES } from './app/lib/rush.ts';

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


  // Rush mode
  {
    assert(rushDensity(0, 0) === 0.12, 'Rush: tied players get base density');
    assert(Math.abs(rushDensity(1, 3) - 0.24) < 1e-9, 'Rush: each opponent clear adds +4% to your next board');
    assert(rushDensity(3, 0) === 0.12, 'Rush: your own clears do not raise your density');
    assert(rushDensity(0, 50) === 0.4, 'Rush: density is capped');
    assert(rushMineCount(0.12) === 4 && rushMineCount(0) === 1, 'Rush: mine count rounds, minimum 1');

    let seed = 7;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const mines = generateRushMines(8, RUSH_BOARD_SIZE, rnd);
    const uniq = new Set(mines.map((m) => `${m.r},${m.c}`));
    assert(mines.length === 8 && uniq.size === 8 && mines.every((m) => m.r >= 0 && m.r < 6 && m.c >= 0 && m.c < 6), 'Rush: generated mines are unique and in bounds');

    const moved = relocateMine([{ r: 0, c: 0 }, { r: 1, c: 1 }], { r: 0, c: 0 }, 6, rnd);
    assert(moved.length === 2 && !moved.some((m) => m.r === 0 && m.c === 0) && moved.some((m) => m.r === 1 && m.c === 1), 'Rush: first-click mine relocates, count preserved');

    // Fixed board: one mine in the corner.
    const board = { idx: 0, density: 0.12, mine_positions: [{ r: 0, c: 0 }] };
    const fresh = summarizeRush([board], [], 6);
    assert(fresh.lives === RUSH_LIVES && fresh.clears === 0 && fresh.current !== null, 'Rush: fresh run has full lives and a live board');

    const hit = summarizeRush([board], [{ cell: { r: 0, c: 0 }, hit_mine: true, board_idx: 0 }], 6);
    assert(hit.lives === RUSH_LIVES - 1 && hit.clears === 0 && hit.currentIdx === 1 && hit.current === null, 'Rush: a mine costs a life and skips the board');

    const grid = buildAdjacencyGrid({ mine_positions: board.mine_positions }, 6);
    const taken = new Set(fresh.current!.revealed.map((x) => `${x.r},${x.c}`));
    const safe: { r: number; c: number }[] = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!(r === 0 && c === 0) && !taken.has(`${r},${c}`)) safe.push({ r, c });
    const cleared = summarizeRush([board], safe.map((cell) => ({ cell, hit_mine: false, board_idx: 0 })), 6);
    assert(cleared.clears === 1 && cleared.lives === RUSH_LIVES && cleared.currentIdx === 1, 'Rush: revealing every safe cell clears the board');

    const cas = cascadeFrom({ r: 5, c: 5 }, grid, new Set(['0,0']), taken, 6);
    assert(cas.length > 1 && !cas.some((c) => c.r === 0 && c.c === 0), 'Rush: zero cell cascades and never includes a mine');

    const three = [0, 1, 2].map((i) => ({ idx: i, density: 0.12, mine_positions: [{ r: 0, c: 0 }] }));
    const dead = summarizeRush(three, three.map((b) => ({ cell: { r: 0, c: 0 }, hit_mine: true, board_idx: b.idx })), 6);
    assert(dead.lives === 0, 'Rush: three mine hits leave zero lives');

    const a = { ...fresh, clears: 3, lives: 1 };
    const b = { ...fresh, clears: 2, lives: 3 };
    assert(rushWinner(a, 'A', b, 'B') === 'A', 'Rush: time cap — more clears beats more lives');
    assert(rushWinner({ ...a, clears: 2 }, 'A', b, 'B') === 'B', 'Rush: time cap — equal clears falls back to lives');
  }

  console.log(`\nTests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
