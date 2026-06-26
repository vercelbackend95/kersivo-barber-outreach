import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from '../lucide-react';

type ServiceCategoryPickerProps = {
  value: string;
  onChange: (category: string) => void;
  categories: string[];
  onAddCategory: (name: string) => Promise<void>;
  hasError?: boolean;
  disabled?: boolean;
};

export default function ServiceCategoryPicker({
  value,
  onChange,
  categories,
  onAddCategory,
  hasError = false,
  disabled = false
}: ServiceCategoryPickerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const confirmAdd = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setIsAdding(false);
      setInput('');
      return;
    }

    setIsSaving(true);
    setAddError('');
    try {
      await onAddCategory(trimmed);
      onChange(trimmed);
      setInput('');
      setIsAdding(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Could not add category.');
    } finally {
      setIsSaving(false);
    }
  }, [input, onAddCategory, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void confirmAdd();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsAdding(false);
        setInput('');
        setAddError('');
      }
    },
    [confirmAdd]
  );

  const selectedKey = value.trim().toLowerCase();

  return (
    <div className={`admin-service-category-picker${hasError ? ' admin-service-category-picker--error' : ''}`}>
      <div className="admin-service-category-row" role="radiogroup" aria-label="Service category">
        {categories.map((category) => {
          const isSelected = category.trim().toLowerCase() === selectedKey;
          return (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`admin-service-category-pill${isSelected ? ' is-selected' : ''}`}
              disabled={disabled || isSaving}
              onClick={() => onChange(category)}
            >
              {category}
            </button>
          );
        })}
        {isAdding ? (
          <div className="admin-service-category-add-wrap">
            <input
              ref={inputRef}
              type="text"
              className="admin-service-category-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!input.trim() && !isSaving) {
                  setIsAdding(false);
                  setAddError('');
                }
              }}
              placeholder="New category…"
              aria-label="New category name"
              disabled={disabled || isSaving}
            />
            {input.trim() ? (
              <button
                type="button"
                className="admin-service-category-add-btn"
                onClick={() => void confirmAdd()}
                disabled={disabled || isSaving}
                aria-label="Confirm category"
              >
                <Plus className="admin-service-category-add-icon" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="admin-service-category-pill admin-service-category-pill--add"
            disabled={disabled || isSaving}
            onClick={() => {
              setIsAdding(true);
              setAddError('');
            }}
            aria-label="Add custom category"
          >
            <Plus className="admin-service-category-add-icon" aria-hidden />
          </button>
        )}
      </div>
      {addError ? (
        <p className="admin-service-category-error" role="alert">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
