import { useId } from 'react'

export function Logo({ size = 40 }: { size?: number }) {
  const id = `logo${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e2a66" />
          <stop offset="1" stopColor="#0a1030" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb3c9" />
          <stop offset="1" stopColor="#b09aff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}bg)`} />
      <rect x="0.5" y="0.5" width="63" height="63" rx="17.5" fill="none" stroke="rgb(255 255 255 / 0.12)" />
      <path
        d="M32 50 C18 41 12 33 12 25 C12 19 16.5 15 22 15 C26.5 15 29.8 17.6 32 21 C34.2 17.6 37.5 15 42 15 C47.5 15 52 19 52 25 C52 33 46 41 32 50 Z"
        fill={`url(#${id}h)`}
      />
      <path d="M25 30 l5 5 l10 -11" fill="none" stroke="#0a1030" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="13" r="4" fill="#ffd46b" />
    </svg>
  )
}
