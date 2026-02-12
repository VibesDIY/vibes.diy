export interface ActionFunctionArgs {
  request: Request;
}
// app/routes/login.tsx
export async function action({ request: _request }: ActionFunctionArgs) {
  throw new Error("Login action is not impl");
  // const formData = await request.formData();
  // const user = await authenticate(formData);

  // const url = new URL(request.url);
  // const redirectTo = url.searchParams.get('redirectTo') || '/';

  // return redirect(redirectTo, {
  //   headers: { 'Set-Cookie': await createUserSession(user.id) }
  // });
}
