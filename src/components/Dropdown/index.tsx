import { useEffect, useRef, useState } from 'react';

import DropdownItem from './Item';

import './index.scss';

type Direction = 'north' | 'east' | 'south' | 'west';

interface DropdownProps extends React.PropsWithChildren {
	label: string;
	openTo: Direction;
	onlyMouseEvents?: boolean;
}

const DropdownContainer: React.FC<DropdownProps> = ({ label, openTo, children, onlyMouseEvents }) => {
	const [open, setOpen] = useState<boolean>(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const contentsRef = useRef<HTMLDivElement | null>(null);
	
	const onClick = (event: MouseEvent) => {
		if (onlyMouseEvents && event.detail === 0) {
			return;
		}
		
		if (event.target instanceof HTMLButtonElement && contentsRef.current?.contains(event.target) && event.target !== buttonRef.current) {
			if (event.target.classList.contains('item') && event.type === 'mouseup') {
				setOpen(false);
			}
			
			return;
		}
		
		if (event.target === buttonRef.current) {
			if (event.type === 'mousedown') {
				setOpen((open) => !open);
			}
		} else {
			setOpen(false);
		}
	};
	
	useEffect(() => {
		document.addEventListener('mousedown', onClick);
		document.addEventListener('mouseup', onClick);
		
		return () => {
			document.removeEventListener('mousedown', onClick);
			document.removeEventListener('mouseup', onClick);
		}
	}, []);
	
	return (
		<div className={`dropdown ${openTo} ${open ? 'open' : ''}`}>
			<button className={'button noStyle'} ref={buttonRef}>{label}</button>
			<div className={'contents'} ref={contentsRef}>{children}</div>
		</div>
	);
};

export default DropdownContainer;

export { DropdownItem };
