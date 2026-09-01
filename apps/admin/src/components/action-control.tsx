import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentProps,
  PropsWithChildren,
} from "react";

type ActionVariant = "primary" | "secondary" | "surface" | "danger";
type ActionSize = "small" | "medium";

const baseClassName =
  "type-body-small-strong inline-flex items-center justify-center rounded-[var(--radius-lg)] px-[var(--space-sm)] text-center transition-colors duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]";

const variantClassNames: Record<ActionVariant, string> = {
  primary:
    "bg-[var(--action-primary-background)] text-[var(--surface)] hover:bg-[var(--action-primary-pressed)]",
  secondary:
    "bg-[var(--primary-soft)] text-[var(--primary-foreground)] hover:bg-[var(--surface-pressed)]",
  surface:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-pressed)]",
  danger:
    "bg-[var(--action-danger-background)] text-[var(--surface)] hover:bg-[var(--action-danger-pressed)]",
};

const sizeClassNames: Record<ActionSize, string> = {
  small: "min-h-[var(--control-minimum)]",
  medium: "min-h-[var(--control-cta)] px-[var(--space-md)]",
};

function actionClassName({
  variant,
  size,
  fullWidth,
  className,
}: {
  variant: ActionVariant;
  size: ActionSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return [
    baseClassName,
    variantClassNames[variant],
    sizeClassNames[size],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface ActionButtonProps
  extends PropsWithChildren,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ActionVariant;
  size?: ActionSize;
  fullWidth?: boolean;
}

export function ActionButton({
  children,
  variant = "primary",
  size = "small",
  fullWidth,
  className,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={actionClassName({ variant, size, fullWidth, className })}
    >
      {children}
    </button>
  );
}

type NextLinkProps = ComponentProps<typeof Link>;

interface ActionLinkProps extends Omit<NextLinkProps, "className"> {
  variant?: Exclude<ActionVariant, "danger">;
  size?: ActionSize;
  fullWidth?: boolean;
  className?: string;
}

export function ActionLink({
  variant = "primary",
  size = "small",
  fullWidth,
  className,
  ...props
}: ActionLinkProps) {
  return (
    <Link
      {...props}
      className={actionClassName({ variant, size, fullWidth, className })}
    />
  );
}

interface ActionAnchorProps
  extends PropsWithChildren,
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  variant?: Exclude<ActionVariant, "danger">;
  size?: ActionSize;
  fullWidth?: boolean;
}

export function ActionAnchor({
  children,
  variant = "primary",
  size = "small",
  fullWidth,
  className,
  ...props
}: ActionAnchorProps) {
  return (
    <a
      {...props}
      className={actionClassName({ variant, size, fullWidth, className })}
    >
      {children}
    </a>
  );
}
