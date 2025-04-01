import React from 'react';

export interface ReactSet<T> extends React.Dispatch<React.SetStateAction<T>> {}

export interface UserOptions {
	scrollSpeed: number;
	beatSnapDivisor: number;
}

export const DefaultUserOptions: UserOptions = {
	scrollSpeed: 20,
	beatSnapDivisor: 4,
}
