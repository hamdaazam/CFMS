/**
 * Example: How to use the enhanced Input component with validation
 * 
 * This file demonstrates various ways to use the validation features
 */

import React, { useState } from 'react';
import { Input } from '../components/common/Input';
import {
    validateEmail,
    validateCNIC,
    validateName,
    validatePassword,
    validatePhone,
    validateCourseCode,
    sanitizeName,
    sanitizeCNIC,
    sanitizeNumeric,
    sanitizeCourseCode
} from '../utils/validation';

export const ExampleFormWithValidation: React.FC = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        cnic: '',
        phone: '',
        courseCode: '',
        password: '',
        age: '',
    });

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Example: Form with Validation</h2>

            {/* Name Input - Auto-sanitizes to remove special characters */}
            <Input
                label="Full Name"
                value={formData.fullName}
                onChange={handleChange('fullName')}
                placeholder="Enter your full name"
                required
                sanitize={sanitizeName}
                onValidate={(value) => validateName(value, 'Full Name')}
                helperText="Only letters, spaces, hyphens, and apostrophes allowed"
                success
            />

            {/* Email Input - Validates email format */}
            <Input
                type="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="example@university.edu"
                required
                onValidate={validateEmail}
                helperText="Enter your university email address"
                success
            />

            {/* CNIC Input - Auto-formats and validates */}
            <Input
                label="CNIC"
                value={formData.cnic}
                onChange={handleChange('cnic')}
                placeholder="12345-1234567-1"
                required
                sanitize={sanitizeCNIC}
                onValidate={validateCNIC}
                maxLength={15}
                helperText="13-digit national ID number"
                success
            />

            {/* Phone Input - Sanitizes to numbers only */}
            <Input
                label="Phone Number"
                value={formData.phone}
                onChange={handleChange('phone')}
                placeholder="0300-1234567"
                onValidate={validatePhone}
                helperText="Optional: Enter your contact number"
            />

            {/* Course Code Input - Auto-formats to uppercase */}
            <Input
                label="Course Code"
                value={formData.courseCode}
                onChange={handleChange('courseCode')}
                placeholder="CS101"
                required
                sanitize={sanitizeCourseCode}
                onValidate={validateCourseCode}
                maxLength={9}
                showCharCount
                helperText="E.g., CS101, MATH201"
                success
            />

            {/* Password Input - Strong password validation */}
            <Input
                type="password"
                label="Password"
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="Enter a strong password"
                required
                onValidate={validatePassword}
                helperText="At least 8 characters with uppercase, lowercase, and numbers"
                showCharCount
                maxLength={128}
                success
            />

            {/* Numeric Input - Only allows numbers */}
            <Input
                label="Age"
                value={formData.age}
                onChange={handleChange('age')}
                placeholder="Enter your age"
                sanitize={sanitizeNumeric}
                onValidate={(value) => {
                    const age = parseInt(value);
                    if (isNaN(age)) {
                        return { isValid: false, error: 'Please enter a valid age' };
                    }
                    if (age < 18) {
                        return { isValid: false, error: 'You must be at least 18 years old' };
                    }
                    if (age > 100) {
                        return { isValid: false, error: 'Please enter a valid age' };
                    }
                    return { isValid: true };
                }}
                maxLength={3}
                success
            />

            <button className="w-full px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-semibold">
                Submit Form
            </button>
        </div>
    );
};
