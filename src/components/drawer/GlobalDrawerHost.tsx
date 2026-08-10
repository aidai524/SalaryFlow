import { RecipientPickerDrawer } from "./RecipientPickerDrawer";

/** Mount once under AppLayout so drawers can open from any admin page. */
export function GlobalDrawerHost() {
  return (
    <>
      <RecipientPickerDrawer />
    </>
  );
}
