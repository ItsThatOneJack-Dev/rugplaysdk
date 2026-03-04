export interface TowerDifficultySentinel {
    readonly __towerDifficulty: true;
    readonly id: string;
}

function d(id: string): TowerDifficultySentinel {
    return Object.freeze({ __towerDifficulty: true as const, id });
}

export const towerDifficulty = {
    EASY: d("easy"),
    MEDIUM: d("medium"),
    HARD: d("hard"),
} as const;
