import { useCallback, useRef, useState } from 'react';

type PressEvent = React.TouchEvent | React.MouseEvent;

const isTouchEvent = (event: Event | PressEvent): event is TouchEvent | React.TouchEvent => {
    return 'touches' in event;
};

const preventDefault = (event: Event) => {
    if (!isTouchEvent(event)) return;

    if (event.touches.length < 2 && event.preventDefault) {
        event.preventDefault();
    }
};

const useLongPress = (
    onLongPress: (e: PressEvent) => void,
    onClick: (e: PressEvent) => void,
    { shouldPreventDefault = true, delay = 500 } = {}
) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeout = useRef<NodeJS.Timeout | undefined>(undefined);
    const target = useRef<EventTarget | null>(null);

    const start = useCallback(
        (event: React.TouchEvent | React.MouseEvent) => {
            if (shouldPreventDefault && event.target) {
                event.target.addEventListener('touchend', preventDefault, {
                    passive: false
                });
                target.current = event.target;
            }
            timeout.current = setTimeout(() => {
                onLongPress(event);
                setLongPressTriggered(true);
            }, delay);
        },
        [onLongPress, delay, shouldPreventDefault]
    );

    const clear = useCallback(
        (event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
            if (timeout.current) clearTimeout(timeout.current);
            if (shouldTriggerClick && !longPressTriggered) onClick(event);
            setLongPressTriggered(false);
            if (shouldPreventDefault && target.current) {
                target.current.removeEventListener('touchend', preventDefault);
            }
        },
        [shouldPreventDefault, onClick, longPressTriggered]
    );

    return {
        onMouseDown: (e: React.MouseEvent) => start(e),
        onTouchStart: (e: React.TouchEvent) => start(e),
        onMouseUp: (e: React.MouseEvent) => clear(e),
        onMouseLeave: (e: React.MouseEvent) => clear(e, false),
        onTouchEnd: (e: React.TouchEvent) => clear(e),
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            onLongPress(e);
        }
    };
};

export default useLongPress;
