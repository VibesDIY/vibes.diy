// app/lib/auth.ts
// import { redirect } from 'react-router';

export function requireAuth(_request: Request) {
  throw new Error("Auth check is not implemented");
  // const isAuthenticated = checkAuthStatus(); // your auth check

  // if (!isAuthenticated) {
  //   const url = new URL(request.url);
  //   // Save the attempted URL for redirect after login
  //   throw redirect(`/login?redirectTo=${url.pathname}`);
  // }

  // return { user: getCurrentUser() };
}
