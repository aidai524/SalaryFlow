import { Link } from "react-router-dom";
import { PlaceholderView } from "../PlaceholderView";

export function RegisterView() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <PlaceholderView
        title="Register"
        description="Public auth route placeholder. Replace with the redesigned registration form."
      />
      <p className="mt-4 text-center text-sm text-[#606060]">
        Already have an account?{" "}
        <Link className="font-medium text-black underline underline-offset-2" to="/login">
          Login
        </Link>
      </p>
    </div>
  );
}
