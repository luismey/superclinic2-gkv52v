import React, { useCallback, useMemo, useRef, useState } from 'react'; // v18.0.0
import { Popover } from '@headlessui/react'; // v1.7.0
import { useVirtual } from 'react-virtual'; // v2.10.4
import clsx from 'clsx'; // v2.0.0
import Button from './Button';
import { COLORS, TRANSITIONS, Z_INDEX } from '../../constants/ui';

// Interfaces
export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  metadata?: Record<string, any>;
}

export interface DropdownProps {
  options: Array<DropdownOption>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  multiple?: boolean;
  className?: string;
  testId?: string;
  virtualize?: boolean;
  searchable?: boolean;
  loading?: boolean;
  renderOption?: (option: DropdownOption) => React.ReactNode;
  onSearch?: (query: string) => void;
  maxHeight?: number;
  groupBy?: (option: DropdownOption) => string;
}

// Custom hook for dropdown state management
const useDropdown = (props: DropdownProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    let filtered = [...props.options];
    
    if (searchQuery && props.searchable) {
      filtered = filtered.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (props.groupBy) {
      const grouped = filtered.reduce((acc, option) => {
        const group = props.groupBy!(option);
        if (!acc[group]) acc[group] = [];
        acc[group].push(option);
        return acc;
      }, {} as Record<string, DropdownOption[]>);

      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [group, options]) => {
          acc.push({ type: 'group', label: group });
          acc.push(...options.map(opt => ({ type: 'option', ...opt })));
          return acc;
        }, [] as Array<any>);
    }

    return filtered;
  }, [props.options, searchQuery, props.searchable, props.groupBy]);

  const rowVirtualizer = useVirtual({
    size: filteredOptions.length,
    parentRef: listRef,
    estimateSize: useCallback(() => 40, []),
    overscan: 5,
  });

  return {
    searchQuery,
    setSearchQuery,
    isOpen,
    setIsOpen,
    containerRef,
    listRef,
    filteredOptions,
    rowVirtualizer,
  };
};

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  error,
  multiple = false,
  className,
  testId,
  virtualize = false,
  searchable = false,
  loading = false,
  renderOption,
  onSearch,
  maxHeight = 300,
  groupBy,
}) => {
  const {
    searchQuery,
    setSearchQuery,
    isOpen,
    setIsOpen,
    containerRef,
    listRef,
    filteredOptions,
    rowVirtualizer,
  } = useDropdown({ options, value, onChange, searchable, groupBy });

  // Handle option selection
  const handleSelect = useCallback((option: DropdownOption) => {
    if (option.disabled) return;

    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [multiple, value, onChange, setIsOpen]);

  // Get selected option label(s)
  const selectedLabel = useMemo(() => {
    if (multiple && Array.isArray(value)) {
      const selected = options.filter(opt => value.includes(opt.value));
      return selected.length 
        ? selected.map(opt => opt.label).join(', ')
        : placeholder;
    }
    const selected = options.find(opt => opt.value === value);
    return selected ? selected.label : placeholder;
  }, [value, options, multiple, placeholder]);

  return (
    <Popover className={clsx('relative w-full focus-within:z-10', className)} ref={containerRef}>
      {({ open }) => (
        <>
          <Popover.Button
            as={Button}
            variant="outline"
            disabled={disabled}
            className={clsx(
              'w-full justify-between text-left',
              error && 'border-error-500 focus:ring-error-500',
              open && 'ring-2 ring-primary-500'
            )}
            data-testid={testId}
          >
            <span className={clsx(
              'truncate',
              !value && 'text-gray-500'
            )}>
              {selectedLabel}
            </span>
            <svg
              className={clsx(
                'ml-2 h-5 w-5 transition-transform',
                open && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Popover.Button>

          <Popover.Panel
            className={clsx(
              'absolute z-20 w-full mt-1 bg-white dark:bg-gray-800',
              'border rounded-md shadow-lg overflow-hidden focus:outline-none'
            )}
            style={{ maxHeight }}
          >
            {searchable && (
              <div className="sticky top-0 p-2 bg-white dark:bg-gray-800 border-b">
                <input
                  type="text"
                  className={clsx(
                    'w-full px-3 py-2 text-sm rounded-md',
                    'border border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500'
                  )}
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    onSearch?.(e.target.value);
                  }}
                />
              </div>
            )}

            <div
              ref={listRef}
              className="overflow-auto"
              style={{ maxHeight: searchable ? maxHeight - 57 : maxHeight }}
            >
              {virtualize ? (
                <div
                  style={{
                    height: `${rowVirtualizer.totalSize}px`,
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.virtualItems.map(virtualRow => {
                    const item = filteredOptions[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.index}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {item.type === 'group' ? (
                          <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-gray-700">
                            {item.label}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={clsx(
                              'w-full px-4 py-2 text-sm text-left transition-colors',
                              'hover:bg-primary-50 dark:hover:bg-primary-900',
                              'focus:outline-none focus:bg-primary-50 dark:focus:bg-primary-900',
                              item.disabled && 'opacity-50 cursor-not-allowed',
                              multiple && Array.isArray(value) && value.includes(item.value) && 'bg-primary-50 dark:bg-primary-900'
                            )}
                            onClick={() => handleSelect(item)}
                            disabled={item.disabled}
                          >
                            {renderOption ? renderOption(item) : item.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                filteredOptions.map((item, index) => (
                  item.type === 'group' ? (
                    <div
                      key={`group-${index}`}
                      className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-gray-700"
                    >
                      {item.label}
                    </div>
                  ) : (
                    <button
                      key={item.value}
                      type="button"
                      className={clsx(
                        'w-full px-4 py-2 text-sm text-left transition-colors',
                        'hover:bg-primary-50 dark:hover:bg-primary-900',
                        'focus:outline-none focus:bg-primary-50 dark:focus:bg-primary-900',
                        item.disabled && 'opacity-50 cursor-not-allowed',
                        multiple && Array.isArray(value) && value.includes(item.value) && 'bg-primary-50 dark:bg-primary-900'
                      )}
                      onClick={() => handleSelect(item)}
                      disabled={item.disabled}
                    >
                      {renderOption ? renderOption(item) : item.label}
                    </button>
                  )
                ))
              )}
            </div>
          </Popover.Panel>
        </>
      )}
    </Popover>
  );
};

export default Dropdown;