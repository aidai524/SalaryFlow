import { Link, useParams } from "react-router-dom";
import { PlaceholderView } from "../PlaceholderView";

export function InviteView() {
  const { token } = useParams();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <PlaceholderView
        title="Accept invitation"
        description={
          token
            ? `Invite token route placeholder (${token}). Replace with the redesigned accept-invite flow.`
            : "Invite route placeholder. Replace with the redesigned accept-invite flow."
        }
      />
      <p className="mt-4 text-center text-sm text-[#606060]">
        <Link className="font-medium text-black underline underline-offset-2" to="/login">
          Back to login
        </Link>
      </p>
    </div>
  );
}
