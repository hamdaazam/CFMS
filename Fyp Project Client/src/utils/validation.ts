/**
 * Validation utility functions for form inputs
 * Provides comprehensive validation with clear error messages
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Email validation
 */
export const validateEmail = (email: string): ValidationResult => {
    if (!email || email.trim() === '') {
        return { isValid: false, error: 'Email is required' };
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true };
};

/**
 * CNIC validation (Pakistani National ID: 13 digits, format: XXXXX-XXXXXXX-X)
 */
export const validateCNIC = (cnic: string): ValidationResult => {
    if (!cnic || cnic.trim() === '') {
        return { isValid: false, error: 'CNIC is required' };
    }

    // Remove dashes for validation
    const cnicDigits = cnic.replace(/-/g, '');

    if (!/^\d{13}$/.test(cnicDigits)) {
        return { isValid: false, error: 'CNIC must be 13 digits (e.g., 12345-1234567-1)' };
    }

    return { isValid: true };
};

/**
 * Name validation (alphabets, spaces, hyphens only)
 */
export const validateName = (name: string, fieldName: string = 'Name'): ValidationResult => {
    if (!name || name.trim() === '') {
        return { isValid: false, error: `${fieldName} is required` };
    }

    if (name.trim().length < 2) {
        return { isValid: false, error: `${fieldName} must be at least 2 characters` };
    }

    if (name.trim().length > 100) {
        return { isValid: false, error: `${fieldName} must not exceed 100 characters` };
    }

    // Allow letters (including Unicode for international names), spaces, hyphens, apostrophes
    const nameRegex = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'-]+$/;
    if (!nameRegex.test(name)) {
        return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }

    return { isValid: true };
};

/**
 * Password validation
 */
export const validatePassword = (password: string): ValidationResult => {
    if (!password || password.trim() === '') {
        return { isValid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { isValid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
        return { isValid: false, error: 'Password must not exceed 128 characters' };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one number' };
    }

    return { isValid: true };
};

/**
 * Phone number validation
 */
export const validatePhone = (phone: string): ValidationResult => {
    if (!phone || phone.trim() === '') {
        return { isValid: true }; // Phone is optional in most cases
    }

    // Remove spaces, dashes, and parentheses
    const phoneDigits = phone.replace(/[\s\-()]/g, '');

    // Allow optional country code (+92) followed by 10 digits
    const phoneRegex = /^(\+92)?[0-9]{10,11}$/;
    if (!phoneRegex.test(phoneDigits)) {
        return { isValid: false, error: 'Please enter a valid phone number (e.g., 0300-1234567)' };
    }

    return { isValid: true };
};

/**
 * Course code validation (e.g., CS101, MATH201)
 */
export const validateCourseCode = (code: string): ValidationResult => {
    if (!code || code.trim() === '') {
        return { isValid: false, error: 'Course code is required' };
    }

    const codeRegex = /^[A-Z]{2,5}[0-9]{3,4}$/i;
    if (!codeRegex.test(code)) {
        return { isValid: false, error: 'Course code must be in format: 2-5 letters followed by 3-4 digits (e.g., CS101)' };
    }

    return { isValid: true };
};

/**
 * Alphanumeric validation (letters, numbers, spaces only)
 */
export const validateAlphanumeric = (value: string, fieldName: string = 'Field'): ValidationResult => {
    if (!value || value.trim() === '') {
        return { isValid: false, error: `${fieldName} is required` };
    }

    const alphanumericRegex = /^[a-zA-Z0-9\s]+$/;
    if (!alphanumericRegex.test(value)) {
        return { isValid: false, error: `${fieldName} can only contain letters, numbers, and spaces` };
    }

    return { isValid: true };
};

/**
 * Number validation
 */
export const validateNumber = (
    value: string | number,
    fieldName: string = 'Number',
    min?: number,
    max?: number
): ValidationResult => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    if (min !== undefined && numValue < min) {
        return { isValid: false, error: `${fieldName} must be at least ${min}` };
    }

    if (max !== undefined && numValue > max) {
        return { isValid: false, error: `${fieldName} must not exceed ${max}` };
    }

    return { isValid: true };
};

/**
 * URL validation
 */
export const validateURL = (url: string): ValidationResult => {
    if (!url || url.trim() === '') {
        return { isValid: true }; // URL is optional in most cases
    }

    try {
        new URL(url);
        return { isValid: true };
    } catch {
        return { isValid: false, error: 'Please enter a valid URL (e.g., https://example.com)' };
    }
};

/**
 * Required field validation
 */
export const validateRequired = (value: string | number | boolean | null | undefined, fieldName: string = 'Field'): ValidationResult => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return { isValid: false, error: `${fieldName} is required` };
    }

    return { isValid: true };
};

/**
 * Text length validation
 */
export const validateLength = (
    value: string,
    fieldName: string = 'Field',
    min?: number,
    max?: number
): ValidationResult => {
    if (!value) {
        return { isValid: false, error: `${fieldName} is required` };
    }

    const length = value.trim().length;

    if (min !== undefined && length < min) {
        return { isValid: false, error: `${fieldName} must be at least ${min} characters` };
    }

    if (max !== undefined && length > max) {
        return { isValid: false, error: `${fieldName} must not exceed ${max} characters` };
    }

    return { isValid: true };
};

/**
 * Input sanitizers - Remove special characters
 */

export const sanitizeName = (value: string): string => {
    // Allow only letters, spaces, hyphens, and apostrophes
    return value.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'-]/g, '');
};

export const sanitizeAlphanumeric = (value: string): string => {
    // Allow only letters, numbers, and spaces
    return value.replace(/[^a-zA-Z0-9\s]/g, '');
};

export const sanitizeNumeric = (value: string): string => {
    // Allow only numbers
    return value.replace(/[^0-9]/g, '');
};

export const sanitizeCNIC = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/[^0-9]/g, '');

    // Format as XXXXX-XXXXXXX-X
    if (digits.length <= 5) {
        return digits;
    } else if (digits.length <= 12) {
        return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
        return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
};

export const sanitizePhone = (value: string): string => {
    // Remove all non-digits except + at the start
    const hasPlus = value.startsWith('+');
    const digits = value.replace(/[^0-9]/g, '');

    return hasPlus ? `+${digits}` : digits;
};

export const sanitizeCourseCode = (value: string): string => {
    // Allow only letters and numbers, convert to uppercase
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};
