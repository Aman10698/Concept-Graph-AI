import React from 'react'

export default function Input({
  type = 'text',
  placeholder = '',
  className = '',
  value,
  onChange,
  disabled = false,
  required = false,
  ...props
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 transition-all ${className} ${
        disabled ? 'bg-gray-100 cursor-not-allowed' : ''
      }`}
      {...props}
    />
  )
}
