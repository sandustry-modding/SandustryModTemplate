export type ActionSlotProps = Parameters<typeof sandkit.api.ui.components.ActionSlot>[0];
export type HotbarBankSource = ReturnType<typeof sandkit.api.ui.hotbar.createBankSource>;

/** Host `api.ui.components.ActionSlot` as a JSX component. */
export function ActionSlot(props: ActionSlotProps) {
  const Component = sandkit.api.ui.components.ActionSlot;
  return <Component {...props} />;
}
