export type PanelProps = Parameters<typeof sandkit.api.ui.components.Panel>[0];

/** Host `api.ui.components.Panel` as a JSX component. */
export function Panel(props: PanelProps) {
  const Component = sandkit.api.ui.components.Panel;
  return <Component {...props} />;
}
