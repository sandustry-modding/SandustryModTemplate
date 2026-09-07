export type ButtonProps = Parameters<typeof sandkit.api.ui.components.Button>[0];

/** Host `api.ui.components.Button` as a JSX component. */
export function Button(props: ButtonProps) {
  const Component = sandkit.api.ui.components.Button;
  return <Component {...props} />;
}
