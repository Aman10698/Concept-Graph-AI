import React from 'react'

export default function Card({ children, className = '', variant = 'default' }) {
  const baseStyles = 'card'
  const variantStyles = {
    default: '',
    elevated: 'shadow-lg',
    border: 'border border-gray-200',
  }

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  )
}
