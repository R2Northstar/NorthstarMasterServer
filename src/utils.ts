export type OnlyProperties<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [P in keyof T as T[P] extends Function ? never : P]: T[P]
}
