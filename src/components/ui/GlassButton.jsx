const variantClasses = {
  primary: 'glass-primary',
  secondary: 'glass-secondary',
  'accent-purple': 'glass-accent-purple',
  'accent-amber': 'glass-accent-amber',
  danger: 'glass-danger',
  ghost: 'glass-ghost',
}

const sizeClasses = {
  lg: 'glass-btn-lg',
  md: 'glass-btn-md',
  sm: 'glass-btn-sm',
  xs: 'glass-btn-xs',
  icon: 'glass-btn-icon',
}

const pillColorClasses = {
  emerald: 'glass-pill-emerald',
  purple: 'glass-pill-purple',
  cyan: 'glass-pill-cyan',
  amber: 'glass-pill-amber',
}

export default function GlassButton({
  variant = 'primary',
  size = 'md',
  pill = false,
  pillColor,
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const isDisabled = disabled || loading

  const classes = [
    'glass-btn',
    pill ? 'glass-btn-pill' : sizeClasses[size],
    pill && pillColor ? pillColorClasses[pillColor] : variantClasses[variant],
    fullWidth && 'glass-btn-full',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="glass-spinner" />}
      {loading ? null : children}
    </button>
  )
}
