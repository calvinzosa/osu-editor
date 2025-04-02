import React from 'react';

export interface ReactSet<T> extends React.Dispatch<React.SetStateAction<T>> {}

export enum EditMode {
	Selection = 0,
	HitObject = 1,
	Delete = 2,
}

export interface UserOptions {
	scrollSpeed: number;
	beatSnapDivisor: number;
	hitPosition: number;
	playBackSpeed: number;
	speedAdjustsPitch: boolean;
	laneWidthPercent: number;
}

export const DefaultUserOptions: UserOptions = {
	scrollSpeed: 20,
	beatSnapDivisor: 4,
	hitPosition: 420,
	playBackSpeed: 1,
	speedAdjustsPitch: false,
	laneWidthPercent: 27.5,
}
