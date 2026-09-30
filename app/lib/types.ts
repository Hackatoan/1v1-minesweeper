export type MinePosition = {
    r: number;
    c: number;
};

export type Board = {
    id?: string;
    game_id?: string;
    owner_id?: string;
    mine_positions: MinePosition[];
    reveal_state?: unknown[];
    created_at?: string;
};

export type Move = {
    id?: string;
    game_id?: string;
    player_id: string;
    cell: MinePosition;
    timestamp?: string;
    hit_mine?: boolean;
};

// What the client sends to POST /api/games/[id]/moves — a subset of Move;
// player_id/timestamp/id are assigned server-side, hit_mine is recomputed
// server-side too (never trusted from this input).
export type MoveInput = {
    cell: MinePosition;
    hit_mine?: boolean;
};

export type GameStatus = 'waiting' | 'setup' | 'playing' | 'finished';

export type Game = {
    id: string;
    status: GameStatus;
    player1_id: string;
    player2_id?: string | null;
    winner_id?: string | null;
    rematch_game_id?: string | null;
    board_size: number;
    is_public: boolean;
    last_ping?: string;
    player_pings?: Record<string, string>;
    created_at?: string;
    player1_name?: string | null;
    player2_name?: string | null;
    // Firebase uid captured from a verified X-Id-Token header, if the
    // acting player was signed in when they last touched this game. Null
    // for anonymous nickname-only play.
    player1_uid?: string | null;
    player2_uid?: string | null;
};

export type LeaderboardEntry = {
    player: string;
    wins: number;
    losses: number;
    draws: number;
    games_played: number;
};
