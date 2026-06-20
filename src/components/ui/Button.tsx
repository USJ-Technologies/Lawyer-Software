import type { ButtonHTMLAttributes } from 'react'
import Link, { type LinkProps } from 'next/link'

type Variant = 'primary' | 'ghost'

export const buttonBase =
  'inline-flex items-center justify-center font-mono text-sm uppercase tracking-wide transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal'

export const buttonVariants: Record<Variant, string> = {
  primary: 'bg-ink text-paper px-4 py-2 hover:bg-seal',
  ghost: 'text-seal underline-offset-4 hover:underline px-0 py-1',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />
}

/** Same visual treatment as Button, but renders an anchor — for navigating, not submitting. */
export function ButtonLink({
  variant = 'primary',
  className = '',
  children,
  ...props
}: LinkProps & { variant?: Variant; className?: string; children: React.ReactNode }) {
  return (
    <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  )
}
