import 'fs';

declare module 'fs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function lstatSync(path: string): any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function statSync(path: string): any;
}
