/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  desc?: string;
}

interface CustomDropdownProps {
  value: string;
  options: (DropdownOption | string)[];
  onChange: (val: string) => void;
  placeholder?: string;
  theme?: any;
  variant?: 'tactile-light' | 'tactile-dark' | 'glass-dark' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
  minWidth?: string | number;
  className?: string;
  align?: 'left' | 'right';
  dropUp?: boolean;
}

export default function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  theme,
  variant = 'tactile-light',
  size = 'md',
  accentColor,
  minWidth,
  className = '',
  align = 'right',
  dropUp = false,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const accent = accentColor || theme?.accent || '#F59E0B';

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Variant Styles
  let triggerStyles: React.CSSProperties = {};
  let triggerClasses = '';

  if (variant === 'tactile-light') {
    triggerStyles = {
      backgroundColor: theme?.btnLightBg || '#e2e2e8',
      color: theme?.btnLightText || '#2c2d33',
      boxShadow: isOpen
        ? 'inset 0 2px 4px rgba(0,0,0,0.2)'
        : `inset 0 1px 0 rgba(255,255,255,0.6), 0 3px 0 ${theme?.btnLightBorder || '#c0c0c6'}, 0 4px 6px rgba(0,0,0,0.15)`,
    };
    triggerClasses = 'font-bold tracking-wide rounded-lg flex items-center justify-between transition-all select-none';
  } else if (variant === 'tactile-dark') {
    triggerStyles = {
      backgroundColor: theme?.btnDarkBg || '#2a2b36',
      color: theme?.btnDarkText || '#D9D9D9',
      borderColor: 'rgba(255,255,255,0.08)',
      boxShadow: isOpen
        ? 'inset 0 2px 4px rgba(0,0,0,0.4)'
        : `inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 0 ${theme?.btnDarkBorder || '#1b1c23'}, 0 6px 10px rgba(0,0,0,0.2)`,
    };
    triggerClasses = 'font-bold tracking-wide rounded-xl border flex items-center justify-between transition-all select-none';
  } else if (variant === 'glass-dark') {
    triggerStyles = {
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderColor: 'rgba(255,255,255,0.12)',
      color: theme?.textMain || '#ffffff',
    };
    triggerClasses = 'font-medium rounded-xl border flex items-center justify-between transition-all select-none hover:border-white/20';
  } else if (variant === 'pill') {
    triggerStyles = {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderColor: `${accent}66`,
      color: theme?.textMain || '#ffffff',
    };
    triggerClasses = 'font-bold rounded-full border flex items-center justify-between transition-all select-none hover:scale-105';
  }

  // Size styling
  let sizeClasses = 'px-3 py-1.5 text-sm gap-2';
  let chevronSize = 16;
  if (size === 'sm') {
    sizeClasses = 'px-2.5 py-1 text-xs gap-1.5';
    chevronSize = 14;
  } else if (size === 'lg') {
    sizeClasses = 'px-4 py-2.5 text-base gap-3';
    chevronSize = 20;
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ minWidth: minWidth || (size === 'lg' ? '140px' : '120px') }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${sizeClasses} ${triggerClasses} active:translate-y-[1px]`}
        style={triggerStyles}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={chevronSize}
          className={`shrink-0 transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180 opacity-100' : ''}`}
          style={isOpen ? { color: accent } : {}}
        />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 6 : -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-[300] min-w-[200px] w-max max-w-[380px] p-1.5 rounded-2xl shadow-2xl border backdrop-blur-2xl ${
              dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
            } ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{
              backgroundColor: `${theme?.panelOuter || '#292a34'}f8`,
              borderColor: 'rgba(255,255,255,0.14)',
              boxShadow: `0 20px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1 p-0.5">
              {normalizedOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-white/15 text-white font-bold shadow-inner'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.desc && (
                        <span className="text-[10px] opacity-60 font-normal truncate mt-0.5">
                          {option.desc}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {option.badge && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-white/10"
                          style={{ color: accent }}
                        >
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={14} strokeWidth={2.5} style={{ color: accent }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
