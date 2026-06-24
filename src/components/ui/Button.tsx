/**
 * Button Component
 *
 * Unified button component supporting the button variants used across the app.
 *
 * @example
 * <Button variant="primary" size="lg" loading={isLoading}>
 *   Submit
 * </Button>
 */

import React from 'react';
import { ButtonProps } from './Button.types';

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    // Base styles applied to all buttons
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    `;

    // Variant-specific styles
    const variantStyles = {
      primary: `
        bg-primary
        text-white
        hover:bg-primary-hover hover:shadow-lg hover:-translate-y-0.5
        focus:ring-primary
        active:translate-y-0
      `,
      secondary: `
        bg-white text-gray-800
        border border-gray-300
        hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5
        focus:ring-gray-300
        active:translate-y-0
      `,
      danger: `
        bg-danger text-white
        hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5
        focus:ring-danger
        active:translate-y-0
      `,
      success: `
        bg-success text-white
        hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5
        focus:ring-success
        active:translate-y-0
      `,
      outline: `
        bg-transparent text-primary
        border-2 border-primary
        hover:bg-primary hover:text-white hover:-translate-y-0.5
        focus:ring-primary
        active:translate-y-0
      `,
      ghost: `
        bg-transparent text-gray-700
        hover:bg-gray-100 hover:text-gray-900
        focus:ring-gray-300
      `,
      admin: `
        bg-gradient-to-r from-[#1a1a2e] to-[#16213e]
        text-white
        hover:shadow-lg hover:-translate-y-0.5
        focus:ring-[#1a1a2e]
        active:translate-y-0
      `,
    };

    // Size-specific styles
    const sizeStyles = {
      sm: 'py-2 px-4 text-sm',
      md: 'py-3 px-6 text-base',
      lg: 'py-4 px-8 text-lg',
      full: 'py-3 px-6 text-base w-full',
    };

    // Determine actual size (handle fullWidth)
    const actualSize = fullWidth ? 'full' : size;

    // Combine all styles
    const combinedClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[actualSize]}
      ${className}
    `
      .trim()
      .replace(/\s+/g, ' ');

    // Loading spinner component
    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    // Render icon on the left
    const renderLeftContent = () => {
      if (loading) return <LoadingSpinner />;
      if (icon && iconPosition === 'left') return icon;
      return null;
    };

    // Render icon on the right
    const renderRightContent = () => {
      if (icon && iconPosition === 'right' && !loading) return icon;
      return null;
    };

    return (
      <button ref={ref} className={combinedClassName} disabled={disabled || loading} {...props}>
        {renderLeftContent()}
        {children}
        {renderRightContent()}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
