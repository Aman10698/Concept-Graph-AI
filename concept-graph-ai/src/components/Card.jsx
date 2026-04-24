export default function Card({ children, className }) {
  return (
    <div className={`card transition-all hover:-translate-y-1 ${className}`}>
      {children}
    </div>
  )
}
