import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  success?: boolean;
  helperText?: string;
  maxLength?: number;
  pattern?: string;
  validationType?: 'name' | 'email' | 'cnic' | 'phone' | 'alphanumeric' | 'numeric' | 'courseCode' | 'none';
  onValidate?: (value: string) => { isValid: boolean; error?: string };
  sanitize?: (value: string) => string;
  showCharCount?: boolean;
  name?: string;
  autoComplete?: string;
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value = '',
  onChange,
  label,
  className = '',
  disabled = false,
  required = false,
  error,
  success = false,
  helperText,
  maxLength,
  pattern,
  validationType = 'none',
  onValidate,
  sanitize,
  showCharCount = false,
  name,
  autoComplete,
}) => {
  const [touched, setTouched] = useState(false);
  const [localError, setLocalError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Apply sanitization if provided
    if (sanitize) {
      newValue = sanitize(newValue);
      e.target.value = newValue;
    }

    // Apply validation if provided
    if (onValidate && touched) {
      const validationResult = onValidate(newValue);
      setLocalError(validationResult.isValid ? '' : validationResult.error || '');
    }

    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (onValidate && value) {
      const validationResult = onValidate(value);
      setLocalError(validationResult.isValid ? '' : validationResult.error || '');
    }
  };

  const displayError = error || localError;
  const hasError = !!displayError;
  const showSuccess = success && !hasError && touched && value;

  // Determine border color based on state
  let borderClass = 'border-gray-300 focus:border-slate-500';
  if (hasError) {
    borderClass = 'border-red-400 focus:border-red-500';
  } else if (showSuccess) {
    borderClass = 'border-green-400 focus:border-green-500';
  }

  // Determine ring color
  let ringClass = 'focus:ring-slate-200';
  if (hasError) {
    ringClass = 'focus:ring-red-100';
  } else if (showSuccess) {
    ringClass = 'focus:ring-green-100';
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete}
          className={`w-full px-4 py-2.5 border rounded-lg transition-all duration-200 
            focus:outline-none focus:ring-2 ${ringClass} ${borderClass}
            disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
            placeholder:text-gray-400 ${hasError ? 'pr-10' : ''} ${showSuccess ? 'pr-10' : ''} ${className}`}
        />

        {/* Error Icon */}
        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
        )}

        {/* Success Icon */}
        {showSuccess && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {hasError && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 font-medium">{displayError}</p>
        </div>
      )}

      {/* Helper Text */}
      {!hasError && helperText && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{helperText}</p>
        </div>
      )}

      {/* Character Count */}
      {showCharCount && maxLength && (
        <div className="mt-1 text-right">
          <span className={`text-xs ${value.length > maxLength * 0.9 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
            {value.length} / {maxLength}
          </span>
        </div>
      )}
    </div>
  );
};
