import React, { useEffect } from "react";
import { SignIn, useClerk } from "@clerk/react";
import { useNavigate, useSearchParams } from "react-router";
import { gridBackground, cx } from "@vibes.diy/base";

export default function LoginPage() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  useEffect(() => {
    if (clerk.loaded && clerk.isSignedIn) {
      navigate(redirectTo, { replace: true });
    }
  }, [clerk.loaded, clerk.isSignedIn, navigate, redirectTo]);

  return (
    <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
      <SignIn routing="hash" fallbackRedirectUrl={redirectTo} signUpUrl="/login" />
    </div>
  );
}
