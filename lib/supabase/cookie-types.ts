import type { CookieSerializeOptions } from "cookie";

export type CookieToSet = {
  name: string;
  value: string;
  options: CookieSerializeOptions;
};
