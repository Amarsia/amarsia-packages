export function setIfDefined<TObject extends object, TKey extends keyof TObject>(
  target: TObject,
  key: TKey,
  value: TObject[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

