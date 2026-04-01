
import React, { useState, useEffect, useRef } from 'react';
import QRCode from './QRCode';

export interface SmartTextProps {
  initialValue: string;
  className?: string;
  isDesignMode: boolean;
  baseSize: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  font?: 'sans' | 'mono';
  block?: boolean;
  heavy?: boolean; // New prop for Extra Bold / Black weight
  maxLines?: number; // New prop for line clamping
  storageKey?: string; // Unique key for LocalStorage persistence
}

interface StateSnapshot {
  pos: { x: number, y: number };
  size: number;
  isBold: boolean;
}

export const SmartText: React.FC<SmartTextProps> = ({ 
  initialValue, 
  className = '', 
  isDesignMode, 
  baseSize,
  bold = false,
  align = 'left',
  font = 'sans',
  block = false,
  heavy = false,
  maxLines,
  storageKey
}) => {
  const [text, setText] = useState(initialValue);
  const [size, setSize] = useState(baseSize);
  const [isBoldState, setIsBoldState] = useState(bold);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isSelected, setIsSelected] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  
  const [history, setHistory] = useState<StateSnapshot[]>([{ pos: { x: 0, y: 0 }, size: baseSize, isBold: bold }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => { setText(initialValue); }, [initialValue]);
  
  // 1. Load from Storage on Mount or key change
  useEffect(() => {
    if (storageKey) {
        const saved = localStorage.getItem(`smart_${storageKey}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setPos(parsed.pos || { x: 0, y: 0 });
                setSize(parsed.size || baseSize);
                setIsBoldState(parsed.isBold !== undefined ? parsed.isBold : bold);
                setIsCustomized(true);
                // Initialize history with saved state
                setHistory([{ pos: parsed.pos, size: parsed.size, isBold: parsed.isBold }]);
                setHistoryIndex(0);
                return;
            } catch (e) {
                console.error("Error loading smart element state", e);
            }
        }
    }
    // If no storage, revert to not customized
    setIsCustomized(false);
  }, [storageKey]);

  // 2. Sync with props ONLY if not customized by user
  useEffect(() => {
    if (!isCustomized) {
        setSize(baseSize);
        setIsBoldState(bold);
        setHistory([{ pos: { x: 0, y: 0 }, size: baseSize, isBold: bold }]);
        setHistoryIndex(0);
    }
  }, [baseSize, bold, isCustomized]);

  // Helper to save state
  const persistState = (newPos: {x: number, y: number}, newSize: number, newBold: boolean) => {
      if (storageKey) {
          localStorage.setItem(`smart_${storageKey}`, JSON.stringify({ pos: newPos, size: newSize, isBold: newBold }));
          setIsCustomized(true);
      }
  };

  const saveToHistory = (newPos: {x: number, y: number}, newSize: number, newBold: boolean) => {
    const currentHistory = history.slice(0, historyIndex + 1);
    const last = currentHistory[currentHistory.length - 1];

    if (last && 
        last.pos.x === newPos.x && 
        last.pos.y === newPos.y && 
        last.size === newSize && 
        last.isBold === newBold) {
        return;
    }

    const nextHistory = [...currentHistory, { pos: { ...newPos }, size: newSize, isBold: newBold }];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    
    // Persist to local storage
    persistState(newPos, newSize, newBold);
  };

  useEffect(() => {
    if (!isSelected || !isDesignMode) return;

    const handleDesignAction = (e: any) => {
        const { type, payload } = e.detail;
        if (type === 'move') {
            const newPos = { x: pos.x + (payload.x || 0), y: pos.y + (payload.y || 0) };
            setPos(newPos);
            saveToHistory(newPos, size, isBoldState);
        }
        if (type === 'size') {
             const newSize = Math.max(4, Math.min(80, size + payload));
             setSize(newSize);
             saveToHistory(pos, newSize, isBoldState);
        }
        if (type === 'style' && payload.prop === 'bold') {
             const newBold = !isBoldState;
             setIsBoldState(newBold);
             saveToHistory(pos, size, newBold);
        }
        if (type === 'undo' && historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            const prevState = history[prevIndex];
            setPos(prevState.pos); 
            setSize(prevState.size); 
            setIsBoldState(prevState.isBold); 
            setHistoryIndex(prevIndex);
            persistState(prevState.pos, prevState.size, prevState.isBold);
        }
        if (type === 'redo' && historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextState = history[nextIndex];
            setPos(nextState.pos); 
            setSize(nextState.size); 
            setIsBoldState(nextState.isBold); 
            setHistoryIndex(nextIndex);
            persistState(nextState.pos, nextState.size, nextState.isBold);
        }
        if (type === 'reset') {
             setPos({x:0, y:0}); 
             setSize(baseSize); 
             setIsBoldState(bold); 
             saveToHistory({x:0, y:0}, baseSize, bold);
             
             // Clear storage
             if (storageKey) {
                 localStorage.removeItem(`smart_${storageKey}`);
                 setIsCustomized(false);
             }
        }
    };

    window.addEventListener('design-action', handleDesignAction);
    return () => window.removeEventListener('design-action', handleDesignAction);
  }, [isSelected, isDesignMode, baseSize, bold, pos, size, isBoldState, history, historyIndex, storageKey]);

  useEffect(() => {
    if (!isSelected) return;
    
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('#design-sidebar')) {
            return;
        }
        setIsSelected(false);
    };
    
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSelected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDesignMode) return;
    e.stopPropagation(); 
    e.preventDefault(); 
    
    if (!isSelected) setIsSelected(true);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    hasMoved.current = false;
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
    };
    const onUp = () => {
      if (isDragging && hasMoved.current) saveToHistory(pos, size, isBoldState);
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, pos, size, isBoldState]);

  const style: React.CSSProperties = {
    fontSize: `${size}pt`,
    fontWeight: isBoldState ? (heavy ? 900 : 700) : 400,
    textAlign: align,
    fontFamily: font === 'mono' ? '"JetBrains Mono", monospace' : '"Inter", "Kantumruy Pro", sans-serif',
    lineHeight: 1.1,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    cursor: isDesignMode ? 'grab' : 'default',
    display: maxLines ? '-webkit-box' : (block ? 'block' : 'inline-block'),
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: maxLines ? 'vertical' : undefined,
    overflow: maxLines ? 'hidden' : undefined,
    width: block ? '100%' : 'auto',
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    position: 'relative',
    zIndex: isSelected || isDragging ? 50 : 'auto',
    userSelect: 'none',
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`relative rounded transition-all duration-75 ${
          isDesignMode && !isSelected 
            ? 'hover:outline hover:outline-1 hover:outline-black/20 hover:bg-black/[0.02]' 
            : ''
        } ${
          isSelected 
            ? 'ring-2 ring-brand-cyan ring-dashed bg-brand-cyan/5 shadow-sm' 
            : ''
        } ${className}`}
      style={style}
    >
      {text}
      {isSelected && (
        <>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-brand-cyan border border-white rounded-full"></div>
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-brand-cyan border border-white rounded-full"></div>
        </>
      )}
    </div>
  );
};

export const SmartQR: React.FC<{ value: string, baseSize: number, isDesignMode: boolean, storageKey?: string }> = ({ value, baseSize, isDesignMode, storageKey }) => {
    const [size, setSize] = useState(baseSize);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isSelected, setIsSelected] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isCustomized, setIsCustomized] = useState(false);

    const [history, setHistory] = useState<Omit<StateSnapshot, 'isBold'>[]>([{ pos: { x: 0, y: 0 }, size: baseSize }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    // Load from storage
    useEffect(() => {
        if (storageKey) {
            const saved = localStorage.getItem(`smart_qr_${storageKey}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setPos(parsed.pos || { x: 0, y: 0 });
                    setSize(parsed.size || baseSize);
                    setIsCustomized(true);
                    setHistory([{ pos: parsed.pos, size: parsed.size }]);
                    return;
                } catch(e) {}
            }
        }
        setIsCustomized(false);
    }, [storageKey]);

    // Sync if not customized
    useEffect(() => {
        if (!isCustomized) {
            setSize(baseSize);
            setHistory([{ pos: { x: 0, y: 0 }, size: baseSize }]);
            setHistoryIndex(0);
        }
    }, [baseSize, isCustomized]);

    const persistState = (newPos: {x: number, y: number}, newSize: number) => {
        if (storageKey) {
            localStorage.setItem(`smart_qr_${storageKey}`, JSON.stringify({ pos: newPos, size: newSize }));
            setIsCustomized(true);
        }
    };

    const saveToHistory = (newPos: {x: number, y: number}, newSize: number) => {
        const currentHistory = history.slice(0, historyIndex + 1);
        const last = currentHistory[currentHistory.length - 1];

        if (last && 
            last.pos.x === newPos.x && 
            last.pos.y === newPos.y && 
            last.size === newSize) {
            return;
        }

        const nextHistory = [...currentHistory, { pos: { ...newPos }, size: newSize }];
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        persistState(newPos, newSize);
    };

    useEffect(() => {
        if (!isSelected || !isDesignMode) return;
        const handleDesignAction = (e: any) => {
            const { type, payload } = e.detail;
            if (type === 'move') {
                const newPos = { x: pos.x + (payload.x || 0), y: pos.y + (payload.y || 0) };
                setPos(newPos); saveToHistory(newPos, size);
            }
            if (type === 'size') {
                const newSize = Math.max(20, Math.min(200, size + (payload * 5)));
                setSize(newSize); saveToHistory(pos, newSize);
            }
            if (type === 'undo' && historyIndex > 0) {
                const prevIndex = historyIndex - 1;
                const prevState = history[prevIndex];
                setPos(prevState.pos); setSize(prevState.size); 
                setHistoryIndex(prevIndex);
                persistState(prevState.pos, prevState.size);
            }
            if (type === 'redo' && historyIndex < history.length - 1) {
                const nextIndex = historyIndex + 1;
                const nextState = history[nextIndex];
                setPos(nextState.pos); setSize(nextState.size); 
                setHistoryIndex(nextIndex);
                persistState(nextState.pos, nextState.size);
            }
            if (type === 'reset') {
                setPos({x:0, y:0}); setSize(baseSize); 
                saveToHistory({x:0, y:0}, baseSize);
                if(storageKey) {
                    localStorage.removeItem(`smart_qr_${storageKey}`);
                    setIsCustomized(false);
                }
            }
        };
        window.addEventListener('design-action', handleDesignAction);
        return () => window.removeEventListener('design-action', handleDesignAction);
    }, [isSelected, isDesignMode, baseSize, pos, size, history, historyIndex, storageKey]);
  
    useEffect(() => {
        if (!isSelected) return;
        const handleClickOutside = (e: MouseEvent) => {
             const target = e.target as HTMLElement;
             if (target.closest('#design-sidebar')) {
                 return;
             }
            setIsSelected(false);
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isSelected]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!isDesignMode) return;
      e.stopPropagation(); e.preventDefault();
      if (!isSelected) setIsSelected(true);
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...pos };
      hasMoved.current = false;
    };
  
    useEffect(() => {
      if (!isDragging) return;
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
        setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
      };
      const onUp = () => {
        if (isDragging && hasMoved.current) saveToHistory(pos, size);
        setIsDragging(false);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [isDragging, pos, size]);
  
    return (
      <div 
        onMouseDown={handleMouseDown}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, cursor: isDesignMode ? 'grab' : 'default', display: 'inline-block', zIndex: isSelected ? 50 : 'auto', position: 'relative' }}
        className={`relative ${isDesignMode && !isSelected ? "hover:outline hover:outline-1 hover:outline-black/20 rounded" : ""} ${isSelected ? "ring-2 ring-brand-cyan ring-dashed bg-brand-cyan/5 p-1 rounded" : ""}`}
      >
        <QRCode value={value} size={size} />
        {isSelected && (
            <>
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-brand-cyan border border-white rounded-full"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-brand-cyan border border-white rounded-full"></div>
            </>
        )}
      </div>
    );
};
