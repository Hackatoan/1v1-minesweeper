import fs from 'fs';

// Read the actual source files
const constantsSource = fs.readFileSync('app/lib/constants.ts', 'utf8');
const gameLogicSource = fs.readFileSync('app/lib/game-logic.ts', 'utf8');

// Simple extraction of values and functions using regex for the test runner
const boardSizeMatch = constantsSource.match(/export const BOARD_SIZE = (\d+)/);
const BOARD_SIZE = boardSizeMatch ? parseInt(boardSizeMatch[1], 10) : 10;

// Extract the calculateAdjacentMines function body and make it executable in JS
let functionCode = gameLogicSource
  .replace(/import { BOARD_SIZE } from '\.\/constants'/, '')
  .replace(/export const calculateAdjacentMines =/, 'const calculateAdjacentMines =')
  .replace(/: number/g, '')
  .replace(/: any/g, '')
  .replace(/<any>/g, '');

// Create the function in the current scope
const calculateAdjacentMines = new Function('r', 'c', 'board', 'BOARD_SIZE', `
  ${functionCode}
  return calculateAdjacentMines(r, c, board);
`);

console.log('Testing with BOARD_SIZE:', BOARD_SIZE);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

const tests = [
  {
    name: "No adjacent mines",
    r: 1, c: 1,
    board: { mine_positions: [] },
    expected: 0
  },
  {
    name: "Single adjacent mine",
    r: 1, c: 1,
    board: { mine_positions: [{r: 0, c: 0}] },
    expected: 1
  },
  {
    name: "All adjacent mines (8)",
    r: 1, c: 1,
    board: {
      mine_positions: [
        {r: 0, c: 0}, {r: 0, c: 1}, {r: 0, c: 2},
        {r: 1, c: 0},            {r: 1, c: 2},
        {r: 2, c: 0}, {r: 2, c: 1}, {r: 2, c: 2}
      ]
    },
    expected: 8
  },
  {
    name: "Corner cell (0,0) with 3 neighbors",
    r: 0, c: 0,
    board: {
      mine_positions: [
        {r: 0, c: 1}, {r: 1, c: 0}, {r: 1, c: 1}
      ]
    },
    expected: 3
  },
  {
    name: "Edge cell (0,5) with 5 potential neighbors",
    r: 0, c: 5,
    board: {
      mine_positions: [
        {r: 0, c: 4}, {r: 0, c: 6}, {r: 1, c: 4}, {r: 1, c: 5}, {r: 1, c: 6}
      ]
    },
    expected: 5
  },
  {
    name: "Mines at (0,0) should not count for (2,2)",
    r: 2, c: 2,
    board: { mine_positions: [{r: 0, c: 0}] },
    expected: 0
  },
  {
    name: "Cell with a mine on itself should not count itself",
    r: 1, c: 1,
    board: { mine_positions: [{r: 1, c: 1}] },
    expected: 0
  },
  {
    name: "Cell with a mine on itself and neighbors",
    r: 1, c: 1,
    board: { mine_positions: [{r: 1, c: 1}, {r: 0, c: 0}] },
    expected: 1
  },
  {
    name: "Bottom-right corner (BOARD_SIZE-1, BOARD_SIZE-1)",
    r: BOARD_SIZE - 1, c: BOARD_SIZE - 1,
    board: {
        mine_positions: [
            {r: BOARD_SIZE - 2, c: BOARD_SIZE - 2},
            {r: BOARD_SIZE - 2, c: BOARD_SIZE - 1},
            {r: BOARD_SIZE - 1, c: BOARD_SIZE - 2}
        ]
    },
    expected: 3
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = calculateAdjacentMines(test.r, test.c, test.board, BOARD_SIZE);
    if (result !== test.expected) {
        throw new Error(`Expected ${test.expected}, got ${result}`);
    }
    console.log(`✅ ${test.name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${test.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
