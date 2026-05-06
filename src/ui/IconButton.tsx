import { ReactNode } from "react";

type IconButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
};

export function IconButton({ label, icon, onClick, primary = false }: IconButtonProps) {
  return (
    <button
      className={primary ? "icon-button icon-button-primary" : "icon-button"}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
