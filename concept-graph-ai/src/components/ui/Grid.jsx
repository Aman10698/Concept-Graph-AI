import React from 'react'

export default function Grid({ children, className = '', cols = 3, gap = 6 }) {
  const colStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  }

  const gapStyles = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  }

  return (
    <div className={`grid ${colStyles[cols]} ${gapStyles[gap]} ${className}`}>{children}</div>
  )
}
