import React from 'react'

export default function Container({ children, className = '', size = 'lg' }) {
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-7xl',
  }

  return <div className={`mx-auto ${sizeStyles[size]} ${className}`}>{children}</div>
}
