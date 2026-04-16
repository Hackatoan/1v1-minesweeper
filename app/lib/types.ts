export type MinePosition = {
    r: number;
    c: number;
};

export type Board = {
    id?: string;
    game_id?: string;
    owner_id?: string;
    mine_positions: MinePosition[];
    reveal_state?: any[];
    created_at?: string;
};
