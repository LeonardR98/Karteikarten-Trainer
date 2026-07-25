export function Button({ children, className = "", variant, ...props }) {
  const style =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900"
      : "bg-slate-900 text-white";

  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 ${style}
      ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`bg-white ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
