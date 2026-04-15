type OrbitLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: {
    badge: "h-8 w-8",
    ring: "h-4 w-4",
    text: "text-base",
    label: "text-sm",
  },
  md: {
    badge: "h-10 w-10",
    ring: "h-5 w-5",
    text: "text-lg",
    label: "text-base",
  },
  lg: {
    badge: "h-12 w-12",
    ring: "h-6 w-6",
    text: "text-xl",
    label: "text-lg",
  },
} as const;

export function OrbitLogo({ size = "md", className = "" }: OrbitLogoProps) {
  const styles = sizeClasses[size];

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <div className={`relative ${styles.badge} rounded-xl bg-primary text-primary-foreground shadow-sm`}>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="relative flex h-full items-center justify-center">
          <div className={`${styles.ring} rounded-full border-2 border-current/90`} />
          <div className={`absolute ${styles.text} font-black tracking-tight`}>O</div>
        </div>
      </div>
      <div className="leading-none">
        <div className={`${styles.label} font-semibold tracking-tight text-foreground`}>Orbit CRM</div>
      </div>
    </div>
  );
}
