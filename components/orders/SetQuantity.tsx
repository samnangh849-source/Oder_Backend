import React, { useRef, useState } from 'react';

interface SetQuantityProps {
    value: number;
    onChange: (newValue: number) => void;
    label?: string;
    min?: number;
    max?: number;
}

const SetQuantity: React.FC<SetQuantityProps> = ({ 
    value, 
    onChange, 
    label = "ចំនួន*", 
    min = 1,
    max = 99
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);

    const handleIncrement = () => {
        const newValue = Math.min(max, value + 1);
        onChange(newValue);
    };

    const handleDecrement = () => {
        const newValue = Math.max(min, value - 1);
        onChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        
        if (inputValue === '') {
            setIsEditing(true);
            return;
        }
        
        const numValue = parseInt(inputValue, 10);
        if (!isNaN(numValue)) {
            if (numValue < min || numValue > max) {
                // Keep the value for editing but don't call onChange yet
                setIsEditing(true);
            } else {
                onChange(numValue);
                setIsEditing(false);
            }
        }
    };

    const handleInputBlur = () => {
        if (isEditing) {
            const currentInput = inputRef.current;
            if (currentInput && currentInput.value) {
                let numValue = parseInt(currentInput.value, 10);
                
                if (isNaN(numValue) || numValue < min) {
                    numValue = min;
                } else if (numValue > max) {
                    numValue = max;
                }
                
                onChange(numValue);
            } else {
                onChange(min);
            }
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleInputBlur();
            inputRef.current?.blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleIncrement();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement();
        }
    };

    const handleFocus = () => {
        setIsEditing(true);
    };

    const displayValue = isEditing ? (inputRef.current?.value || '') : value;

    return (
        <div className="space-y-1.5 w-full">
            <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1">
                {label}
            </label>
            
            <div className="flex items-center bg-[#0B0E11] rounded-none border-2 border-[#2B3139] h-12 w-full overflow-hidden focus-within:border-[#FCD535] transition-all group shadow-inner">
                {/* Decrement Button */}
                <button 
                    type="button" 
                    className={`
                        w-12 h-full flex items-center justify-center 
                        ${value <= min 
                            ? 'text-[#2B3139] cursor-not-allowed' 
                            : 'text-[#848E9C] hover:text-[#FCD535] hover:bg-[#FCD535]/10 active:bg-[#FCD535]/20'
                        }
                        transition-all border-r-2 border-[#2B3139]
                    `}
                    onClick={handleDecrement}
                    disabled={value <= min}
                    aria-label="ថយចំនួន"
                >
                    <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        strokeWidth={4}
                    >
                        <path d="M20 12H4" />
                    </svg>
                </button>

                {/* Direct Input Field */}
                <input 
                    ref={inputRef}
                    type="number" 
                    inputMode="numeric"
                    value={displayValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    min={min}
                    max={max}
                    step="1"
                    className="flex-1 h-full bg-transparent text-center text-[#EAECEF] font-black text-lg outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none group-focus-within:text-[#FCD535] transition-colors"
                    placeholder={min.toString()}
                    aria-label="ចំនួន"
                />

                {/* Increment Button */}
                <button 
                    type="button" 
                    className={`
                        w-12 h-full flex items-center justify-center 
                        ${value >= max 
                            ? 'text-[#2B3139] cursor-not-allowed' 
                            : 'text-[#848E9C] hover:text-[#FCD535] hover:bg-[#FCD535]/10 active:bg-[#FCD535]/20'
                        }
                        transition-all border-l-2 border-[#2B3139]
                    `}
                    onClick={handleIncrement}
                    disabled={value >= max}
                    aria-label="បន្ថែមចំនួន"
                >
                    <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        strokeWidth={4}
                    >
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
            
            <div className="text-[9px] text-[#474D57] px-1 flex justify-between font-black uppercase tracking-widest">
                <span>Min: {min}</span>
                <span>Max: {max}</span>
            </div>
        </div>
    );
};

export default SetQuantity;