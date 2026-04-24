import React from 'react'

export default function Textarea({
  placeholder = '',
  className = '',
  value,
  onChange,
  disabled = false,
  rows = 4,
  ...props
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      rows={rows}
      className={`input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 transition-all resize-none ${className} ${
        disabled ? 'bg-gray-100 cursor-not-allowed' : ''
      }`}
      {...props}
    />
  )
}
