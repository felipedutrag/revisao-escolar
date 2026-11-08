import React from "react";
import styles from "./brand.module.css";

export function BrandIcon({ size = 23, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${styles.brandIcon} ${className}`}
      aria-hidden="true"
    >
      <rect className={styles.brandRect} x="3" y="3" width="18" height="7" rx="1" pathLength={1} />
      <rect className={`${styles.brandRect} ${styles.brandRect2}`} x="3" y="14" width="9" height="7" rx="1" pathLength={1} />
      <rect className={`${styles.brandRect} ${styles.brandRect3}`} x="16" y="14" width="5" height="7" rx="1" pathLength={1} />
    </svg>
  );
}

export function BrandGlowingIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${styles.glowingIcon} ${className}`}
      aria-hidden="true"
    >
      <rect className={styles.glowingRect} x="3" y="3" width="18" height="7" rx="1" />
      <rect className={styles.glowingRect} x="3" y="14" width="9" height="7" rx="1" />
      <rect className={styles.glowingRect} x="16" y="14" width="5" height="7" rx="1" />
    </svg>
  );
}

export default function Brand({
  className = "",
  onClick,
  plain = false,
  iconOnly = false,
  size = 23,
  badgeText,
}: {
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  plain?: boolean;
  iconOnly?: boolean;
  size?: number;
  badgeText?: string;
}) {
  const content = (
    <>
      <BrandIcon size={size} />
      {!iconOnly && (
        <span className={styles.brandText}>
          legal<span className={styles.light}>funnel</span>
          <sup>®</sup>
        </span>
      )}
      {badgeText && (
        <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#b7cbb11a] border border-[#b7cbb140] text-[#b7cbb1] ml-2 font-medium">
          {badgeText}
        </span>
      )}
    </>
  );

  if (plain || !onClick) {
    return (
      <div 
        className={`${styles.brand} ${className}`} 
        aria-label="LegalFunnel" 
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        {content}
      </div>
    );
  }

  return (
    <button 
      type="button"
      className={`${styles.brand} ${className} bg-transparent border-0 p-0 text-left`} 
      aria-label="LegalFunnel" 
      onClick={onClick}
    >
      {content}
    </button>
  );
}
