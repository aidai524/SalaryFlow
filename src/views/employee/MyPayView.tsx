import { useEffect, useState } from "react";
import { PlaceholderView } from "../PlaceholderView";
import { ChangePasswordDialog } from "@/views/auth/ChangePasswordDialog";
import { useAuthStore } from "@/stores/auth";

export function MyPayView() {
  const mustChangePassword = useAuthStore((state) => state.user?.must_change_password);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (mustChangePassword) {
      setChangePasswordOpen(true);
    }
  }, [mustChangePassword]);

  return (
    <>
      <PlaceholderView
        title="My pay"
        description="Employee home placeholder. Redesign from Figma when the employee screens are provided."
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}
