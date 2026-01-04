type LogoVariant = "line" | "filled";

type HaFamilyLogoProps = {
  variant?: LogoVariant;
  className?: string;
};

function LineLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 64"
      role="img"
      aria-label="Ha family logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="8" width="248" height="48" rx="18" fill="#fff7ed" stroke="#0f766e" strokeWidth="2" />
      <circle cx="42" cy="34" r="14" fill="none" stroke="#0f766e" strokeWidth="2" />
      <circle cx="42" cy="30" r="2" fill="#0f766e" />
      <circle cx="48" cy="30" r="2" fill="#0f766e" />
      <path d="M38 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="34" r="14" fill="none" stroke="#0f766e" strokeWidth="2" />
      <circle cx="84" cy="30" r="2" fill="#0f766e" />
      <circle cx="92" cy="30" r="2" fill="#0f766e" />
      <path d="M84 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="172" cy="34" r="14" fill="none" stroke="#0f766e" strokeWidth="2" />
      <circle cx="168" cy="30" r="2" fill="#0f766e" />
      <circle cx="176" cy="30" r="2" fill="#0f766e" />
      <path d="M168 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="218" cy="34" r="14" fill="none" stroke="#0f766e" strokeWidth="2" />
      <circle cx="214" cy="30" r="2" fill="#0f766e" />
      <circle cx="222" cy="30" r="2" fill="#0f766e" />
      <path d="M214 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <path d="M124 22v20" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M118 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M130 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M122 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M148 22v20" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M154 22c4 5 4 15 0 20" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <text x="132" y="48" fontSize="10" fontWeight="700" fill="#0f766e" textAnchor="middle">
        HA
      </text>
      <text x="108" y="18" fontSize="10" fontWeight="700" fill="#fb7185">
        HAHA
      </text>
      <text x="186" y="18" fontSize="10" fontWeight="700" fill="#22c55e">
        HA
      </text>
    </svg>
  );
}

function FilledLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 64"
      role="img"
      aria-label="Ha family logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="haCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="248" height="48" rx="18" fill="url(#haCard)" stroke="#0f766e" strokeWidth="2" />
      <circle cx="42" cy="34" r="14" fill="#fed7aa" stroke="#0f766e" strokeWidth="2" />
      <circle cx="42" cy="30" r="2" fill="#0f766e" />
      <circle cx="48" cy="30" r="2" fill="#0f766e" />
      <path d="M38 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="34" r="14" fill="#fecdd3" stroke="#0f766e" strokeWidth="2" />
      <circle cx="84" cy="30" r="2" fill="#0f766e" />
      <circle cx="92" cy="30" r="2" fill="#0f766e" />
      <path d="M84 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="172" cy="34" r="14" fill="#bbf7d0" stroke="#0f766e" strokeWidth="2" />
      <circle cx="168" cy="30" r="2" fill="#0f766e" />
      <circle cx="176" cy="30" r="2" fill="#0f766e" />
      <path d="M168 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="218" cy="34" r="14" fill="#bfdbfe" stroke="#0f766e" strokeWidth="2" />
      <circle cx="214" cy="30" r="2" fill="#0f766e" />
      <circle cx="222" cy="30" r="2" fill="#0f766e" />
      <path d="M214 38c4 3 8 3 12 0" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      <path d="M124 22v20" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M118 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M130 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M122 22v7" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M148 22v20" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M154 22c4 5 4 15 0 20" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <text x="132" y="48" fontSize="10" fontWeight="700" fill="#0f766e" textAnchor="middle">
        HA
      </text>
      <text x="108" y="18" fontSize="10" fontWeight="700" fill="#fb7185">
        HAHA
      </text>
      <text x="186" y="18" fontSize="10" fontWeight="700" fill="#22c55e">
        HA
      </text>
    </svg>
  );
}

export default function HaFamilyLogo({ variant = "line", className }: HaFamilyLogoProps) {
  return variant === "filled" ? <FilledLogo className={className} /> : <LineLogo className={className} />;
}
