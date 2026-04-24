import clsx from 'clsx'

export default function Container({ 
  children, 
  size = 'lg',
  className = '',
  ...props 
}) {
  const sizes = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-7xl',
    xl: 'max-w-full',
  }

  return (
    <div
      className={clsx(
        'mx-auto px-4 sm:px-6 lg:px-8',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
