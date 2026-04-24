import React from 'react'

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  ...props
}) {
  const baseStyles = 'btn'
  const variantStyles = {
    primary: 'btn-primary',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
  }

  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
