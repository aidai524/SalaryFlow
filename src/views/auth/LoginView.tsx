import { Link } from "react-router-dom";
import { PlaceholderView } from "../PlaceholderView";

export function LoginView() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <PlaceholderView
        title="Login"
        description="Public auth route placeholder. Replace with the redesigned login form."
      />
      <p className="mt-4 text-center text-sm text-[#606060]">
        No account?{" "}
        <Link className="font-medium text-black underline underline-offset-2" to="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
