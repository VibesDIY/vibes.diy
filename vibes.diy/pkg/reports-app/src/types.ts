export type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "err"; readonly msg: string };
