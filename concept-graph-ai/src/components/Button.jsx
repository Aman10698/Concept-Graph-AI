export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  className = '',
  ...props 
}) {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-300 cursor-pointer'
  
  const variants = {
    primary: 'btn-primary hover:shadow-lg hover:-translate-y-1',
    secondary: 'btn-secondary hover:-translate-y-1',
    outline: 'border-2 border-gray-300 hover:border-indigo-500 text-gray-700 hover:text-indigo-600 px-4 py-2',
    ghost: 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2',
  }

  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
