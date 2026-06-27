/**
 * Button Component Types
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'outline'
  | 'ghost'
  | 'admin';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'full';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant of the button
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Size of the button
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * Shows loading spinner and disables the button
   * @default false
   */
  loading?: boolean;

  /**
   * Icon to display in the button
   */
  icon?: React.ReactNode;

  /**
   * Position of the icon relative to children
   * @default 'left'
   */
  iconPosition?: 'left' | 'right';

  /**
   * Full width button
   * @default false
   */
  fullWidth?: boolean;
}
