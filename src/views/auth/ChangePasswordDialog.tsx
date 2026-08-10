import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangePasswordMutation } from "@/hooks/use-auth-api";
import { useAuthStore } from "@/stores/auth";
import { AuthError, AuthField, authErrorMessage } from "./auth-shared";
import { AUTH_BUTTON_CLASS, AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "./config";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const mustChange = Boolean(user?.must_change_password);
  const changePasswordMutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");
    if (newPassword.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    try {
      const result = await changePasswordMutation.mutateAsync({
        ...(mustChange ? {} : { currentPassword }),
        newPassword,
      });
      if (result.user) setUser(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch {
      // Error rendered from mutation state.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Force change when flag is set — do not allow dismiss.
        if (!next && mustChange) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!mustChange}>
        <DialogHeader>
          <DialogTitle className="font-montserrat">Set your password</DialogTitle>
          <DialogDescription className="font-montserrat">
            {mustChange
              ? "Your account was created from an invitation. Choose a password to keep it secure."
              : "Update your account password."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-1">
          {!mustChange && (
            <AuthField
              id="current-password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          )}
          <AuthField
            id="new-password"
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoFocus
          />
          <div className="mt-5">
            <label htmlFor="confirm-password" className={AUTH_LABEL_CLASS}>
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <AuthError
            message={localError || authErrorMessage(changePasswordMutation.error, "")}
          />

          <DialogFooter className="mt-5 sm:justify-stretch">
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className={`${AUTH_BUTTON_CLASS} mt-0`}
            >
              {changePasswordMutation.isPending ? "Saving…" : "Save password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
