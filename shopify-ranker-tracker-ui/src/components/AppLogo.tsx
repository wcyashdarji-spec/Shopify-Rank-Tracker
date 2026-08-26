interface AppLogoProps {
  size?: number;
}

export default function AppLogo({ size = 32 }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
      {/* Rank chart bars */}
      <rect x="6.5" y="17.5" width="4" height="7.5" rx="1.5" fill="#ffffff" fillOpacity="0.75" />
      <rect x="13.5" y="12.5" width="4" height="12.5" rx="1.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="20.5" y="7.5" width="4" height="17.5" rx="1.5" fill="#ffffff" />
      {/* Rising trend Arrow */}
      <path
        d="M6.5 15.5L13.5 10.5L20.5 5.5M20.5 5.5H15M20.5 5.5V11"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
